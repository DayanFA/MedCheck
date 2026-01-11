import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss']
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  sub?: Subscription;
  constructor(private toast: ToastService) {}
  ngOnInit(): void { this.sub = this.toast.messages$.subscribe(list => this.toasts = list); }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  dismiss(id: number) { this.toast.dismiss(id); }
}
