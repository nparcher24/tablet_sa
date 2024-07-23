import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { MapComponent } from './map/map.component';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'map', component: MapComponent, canActivate: [AuthGuard] },
    { path: '', redirectTo: '/map', pathMatch: 'full' },
    { path: '**', redirectTo: '/map' }
];
