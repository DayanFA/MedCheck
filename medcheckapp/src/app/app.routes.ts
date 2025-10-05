import { Routes } from '@angular/router';
import { AdminPreceptorCodesComponent } from './components/admin/admin-preceptor-codes.component';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { HomeComponent } from './components/home-dispatch/home-dispatch.component';
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
import { EvaluationComponent } from './components/evaluation/evaluation.component';
import { CoordinatorHomeComponent } from './components/coordinator-home/coordinator-home.component';

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
            { path: 'home', component: HomeComponent, canActivate: [roleGuard], data: { roles: ['ALUNO','PRECEPTOR','ADMIN','COORDENADOR'] } },
            { path: 'preceptor/home', redirectTo: 'home', pathMatch: 'full' },
            { path: 'coordenador/home', redirectTo: 'home', pathMatch: 'full' },
            { path: 'checkin', component: AlunoCheckinComponent, canActivate: [roleGuard], data: { roles: ['ALUNO'] } },
            { path: 'credentials', component: PreceptorCodeComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR'] } },
            { path: 'preceptor/codigo', redirectTo: 'credentials', pathMatch: 'full' },
            // Admin visualização de códigos de preceptores (read-only)
            { path: 'preceptors_credentials', component: AdminPreceptorCodesComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'admin/codigos', redirectTo: 'preceptors_credentials', pathMatch: 'full' },
            { path: 'preceptor/avaliar/:alunoId', component: PreceptorEvaluateComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            // Renamed from 'calendario' to 'calendar' (October 2025); keep legacy redirect below
            { path: 'calendar', component: UserCalendarComponent, canActivate: [roleGuard], data: { roles: ['ALUNO','PRECEPTOR','ADMIN','COORDENADOR'] } },
            { path: 'calendario', pathMatch: 'full', redirectTo: 'calendar' },
            // Renamed from 'relatorio' to 'report' (October 2025); keep legacy redirect below
            { path: 'report', component: ReportComponent, canActivate: [roleGuard], data: { roles: ['ALUNO','PRECEPTOR','ADMIN','COORDENADOR'] } },
            { path: 'relatorio', pathMatch: 'full', redirectTo: 'report' },
            // Renamed from 'avaliacao' to 'evaluation' (October 2025); keep legacy redirect below
            { path: 'evaluation', component: EvaluationComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            { path: 'avaliacao', pathMatch: 'full', redirectTo: 'evaluation' },
            // Renamed from 'configuracoes' to 'settings' (October 2025); keep legacy redirect below
            { path: 'settings', component: SettingsComponent },
            { path: 'configuracoes', pathMatch: 'full', redirectTo: 'settings' },
            // Renamed from 'admin/usuarios' to 'users' (October 2025); keep legacy redirect below for backward compatibility
            { path: 'users', component: AdminUsersComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'admin/usuarios', pathMatch: 'full', redirectTo: 'users' },
            // Renamed from 'admin/disciplinas' to 'courses' (October 2025); keep legacy redirect below for backward compatibility
            { path: 'courses', component: AdminDisciplinesComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'admin/disciplinas', pathMatch: 'full', redirectTo: 'courses' },
            // Renamed from 'coordenacao/disciplinas' to 'coordination' (October 2025); keep legacy redirect below for backward compatibility
            { path: 'coordination', component: CoordinatorComponent, canActivate: [roleGuard], data: { roles: ['COORDENADOR','ADMIN'] } },
            { path: 'coordenacao/disciplinas', pathMatch: 'full', redirectTo: 'coordination' },
            // coordinator/home now handled by unified /home dispatcher
        ]
    },
    { path: '**', redirectTo: 'login' }
];
