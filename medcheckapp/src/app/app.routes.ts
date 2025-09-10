import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { HomeComponent } from './components/intern-home/intern-home.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { authGuard } from './services/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'reset-password', component: ResetPasswordComponent },
    {
        path: '',
        component: ShellComponent,
        canActivate: [authGuard],
        children: [
            { path: 'home', component: HomeComponent }
            // futuras rotas autenticadas aqui
        ]
    },
    { path: '**', redirectTo: 'login' }
];
