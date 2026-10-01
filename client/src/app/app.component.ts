import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { PathwayModalComponent } from './shared/components/pathway-modal/pathway-modal.component';
import { LandingComponent } from './features/landing/landing.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, PathwayModalComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  showPathwayModal = false;

  onRouteActivate(componentRef: any): void {
    if (componentRef instanceof LandingComponent) {
      componentRef.openPathway.subscribe(() => {
        this.showPathwayModal = true;
      });
    }
  }
}

export { AppComponent as App };
