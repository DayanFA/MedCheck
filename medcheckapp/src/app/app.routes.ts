import { Routes } from '@angular/router';
import { AdminPreceptorCodesComponent } from './components/admin/admin-preceptor-codes.component';
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
            { path: 'checkin', component: AlunoCheckinComponent, canActivate: [roleGuard], data: { roles: ['ALUNO'] } },
            { path: 'preceptor/codigo', component: PreceptorCodeComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR'] } },
            // Admin visualização de códigos de preceptores (read-only)
            { path: 'admin/codigos', component: AdminPreceptorCodesComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'preceptor/home', component: PreceptorHomeComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            { path: 'preceptor/avaliar/:alunoId', component: PreceptorEvaluateComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            { path: 'calendario', component: UserCalendarComponent, canActivate: [roleGuard], data: { roles: ['ALUNO','PRECEPTOR','ADMIN','COORDENADOR'] } },
            { path: 'relatorio', component: ReportComponent, canActivate: [roleGuard], data: { roles: ['ALUNO','PRECEPTOR','ADMIN','COORDENADOR'] } },
            { path: 'avaliacao', component: EvaluationComponent, canActivate: [roleGuard], data: { roles: ['PRECEPTOR','ADMIN'] } },
            { path: 'configuracoes', component: SettingsComponent },
            { path: 'admin/usuarios', component: AdminUsersComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'admin/disciplinas', component: AdminDisciplinesComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } },
            { path: 'coordenacao/disciplinas', component: CoordinatorComponent, canActivate: [roleGuard], data: { roles: ['COORDENADOR','ADMIN'] } },
            { path: 'coordenador/home', component: CoordinatorHomeComponent, canActivate: [roleGuard], data: { roles: ['COORDENADOR','ADMIN'] } }
        ]
    },
    { path: '**', redirectTo: 'login' }
];
