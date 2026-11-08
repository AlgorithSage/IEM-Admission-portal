import { Pipe, PipeTransform } from '@angular/core';

/**
 * Indian rupee amount with Indian digit grouping: 750000 -> "Rs. 7,50,000".
 * (Angular's number pipe groups the US way: "750,000".)
 *   {{ amount | inr }}            rupees
 *   {{ amountPaise | inr:'paise' }} paise from the gateway
 */
@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, unit: 'rupees' | 'paise' = 'rupees'): string {
    if (value === null || value === undefined || isNaN(Number(value))) return '-';
    const rupees = unit === 'paise' ? Number(value) / 100 : Number(value);
    return `Rs. ${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
}
