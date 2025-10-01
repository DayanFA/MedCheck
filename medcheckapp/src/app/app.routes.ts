import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { HomeComponent } from './components/intern-home/intern-home.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { authGuard } from './services/auth.guard';
import { ShellComponent } from './layout/shell.component';
import { CheckInComponent } from './components/checkin/checkin.component';
import { AlunoCheckinComponent } from './components/aluno-checkin/aluno-checkin.component';
import { PreceptorCodeComponent } from './components/preceptor-code/preceptor-code.component';
import { roleGuard } from './services/role.guard';
import { PreceptorHomeComponent } from './components/preceptor-home/preceptor-home.component';
import { UserCalendarComponent } from './components/calendar/calendar.component';
import { SettingsComponent } from './components/settings/settings.component';
import { AdminUsersComponent } from './components/admin/admin-users.component';
import { AdminDisciplinesComponent } from './components/admin/admin-disciplines.component';
import { CoordinatorComponent } from './components/coordinator/coordinator.component';
import { ReportComponent } from './components/report/report.component';
import { PreceptorEvaluateComponent } from './components/preceptor-evaluate/preceptor-evaluate.component';

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
            { path: 'home', component: HomeComponent },
            { path: 'checkin', component: AlunoCheckinComponent, canActivate: [roleGuard], data: { roles: ['ALUNO'] } },
            { path: 'preceptor/codigo', component: PreceptorCodeComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            { path: 'preceptor/home', component: PreceptorHomeComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            { path: 'preceptor/avaliar/:alunoId', component: PreceptorEvaluateComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            { path: 'calendario', component: UserCalendarComponent, canActivate: [roleGuard], data: { roles: ['ALUNO','PRECEPTOR','ADMIN'] } },
            { path: 'relatorio', component: ReportComponent, canActivate: [roleGuard], data: { roles: ['ALUNO'] } },
            { path: 'configuracoes', component: SettingsComponent },
            { path: 'admin/usuarios', component: AdminUsersComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'admin/disciplinas', component: AdminDisciplinesComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'coordenacao/disciplinas', component: CoordinatorComponent, canActivate: [roleGuard], data: { roles: ['COORDENADOR','ADMIN'] } }
            // futuras rotas autenticadas aqui
        ]
    },
    { path: '**', redirectTo: 'login' }
];
