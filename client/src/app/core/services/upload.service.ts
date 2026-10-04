import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface StagedUpload {
  uploadId: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface UploadConfig {
  driver: 'blob' | 'local';
  maxBytes: number;
  allowedTypes: string[];
}

/**
 * Uploads a document as soon as the applicant picks it and returns an upload ID that the
 * application form references on submit.
 *   blob  — the browser sends the file straight to private Vercel Blob storage (no API size limit),
 *           then the API confirms it and records ownership.
 *   local — the file is posted to the API, which stores it on disk (development).
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly api = environment.apiUrl;
  private config?: Promise<UploadConfig>;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private getConfig(): Promise<UploadConfig> {
    this.config ??= firstValueFrom(this.http.get<UploadConfig>(`${this.api}/uploads/config`)).catch((err) => {
      this.config = undefined; // retry on the next upload
      throw err;
    });
    return this.config;
  }

  async upload(file: File, slot: string): Promise<StagedUpload> {
    const config = await this.getConfig();
    if (config.driver === 'blob') {
      return this.uploadToBlob(file, slot);
    }
    const fd = new FormData();
    fd.append('file', file);
    const res = await firstValueFrom(this.http.post<{ upload: StagedUpload }>(`${this.api}/uploads`, fd));
    return res.upload;
  }

  /** Content of one of the applicant's own uploads that is not attached to an application yet */
  content(uploadId: string) {
    return this.http.get(`${this.api}/uploads/${uploadId}/content`, { responseType: 'blob' });
  }

  /** Best effort: frees storage for a file the applicant replaced before submitting */
  discard(uploadId: string): void {
    this.http.delete(`${this.api}/uploads/${uploadId}`).subscribe({ error: () => {} });
  }

  private async uploadToBlob(file: File, slot: string): Promise<StagedUpload> {
    // Loaded only when Blob storage is in use
    const { upload } = await import('@vercel/blob/client');
    const userId = String(this.auth.currentUser()?._id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const blob = await upload(`applicants/${userId}/${slot}-${safeName}`, file, {
      access: 'private',
      contentType: file.type || undefined,
      handleUploadUrl: `${this.api}/uploads/blob-token`,
      headers: { Authorization: `Bearer ${this.auth.token || ''}` }
    });
    const res = await firstValueFrom(
      this.http.post<{ upload: StagedUpload }>(`${this.api}/uploads/blob-confirm`, { url: blob.url, originalName: file.name })
    );
    return res.upload;
  }
}
