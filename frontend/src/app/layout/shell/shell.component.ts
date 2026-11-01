import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';
import { ThemeToggleComponent } from '../../shared/components';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', icon: 'dashboard', path: '/admin/dashboard' },
    { label: 'Courses', icon: 'menu_book', path: '/admin/courses' },
    { label: 'Examinations', icon: 'fact_check', path: '/admin/examinations' },
    { label: 'Users', icon: 'group', path: '/admin/users' },
  ],
  examiner: [
    { label: 'Dashboard', icon: 'dashboard', path: '/examiner/dashboard' },
    { label: 'My Examinations', icon: 'assignment', path: '/examiner/examinations' },
    { label: 'Evaluations', icon: 'rate_review', path: '/examiner/evaluations' },
  ],
  student: [
    { label: 'Dashboard', icon: 'dashboard', path: '/student/dashboard' },
    { label: 'Examinations', icon: 'fact_check', path: '/student/examinations' },
    { label: 'My Bookings', icon: 'event_available', path: '/student/bookings' },
    { label: 'Results & Export', icon: 'summarize', path: '/student/results' },
  ],
};

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    ThemeToggleComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly currentUser = this.authService.currentUser;

  readonly isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  readonly sidenavOpened = signal(true);

  readonly navItems = computed<NavItem[]>(() => {
    const role = this.currentUser()?.role;
    return role ? NAV_ITEMS[role] : [];
  });

  readonly roleLabel = computed(() => {
    const role = this.currentUser()?.role;
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  });

  readonly initials = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    const first = user.first_name?.[0] ?? '';
    const last = user.last_name?.[0] ?? '';
    return (first + last).toUpperCase();
  });

  toggleSidenav(): void {
    this.sidenavOpened.update((opened) => !opened);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
