import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

// Toast mixin for top-right toasts
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  customClass: {
    popup: 'swal2-toast-custom'
  },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

export const toastSuccess = (title, text) => Toast.fire({ icon: 'success', title, text });
export const toastError = (title, text) => Toast.fire({ icon: 'error', title, text });
export const toastInfo = (title, text) => Toast.fire({ icon: 'info', title, text });

// Centralized success notifier that only emits toasts for canonical CRUD actions.
// Allowed actions: 'added', 'updated', 'deleted' (case-insensitive).
export const notifySuccess = (action, title, text) => {
  try {
    const a = String(action || '').toLowerCase();
    const map = { added: 'Added', updated: 'Updated', deleted: 'Deleted' };
    if (!map[a]) {
      // Suppress non-CRUD success notifications to enforce policy.
      // Keep a debug log so developers can see suppressed messages in dev.
      if (process && process.env && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug(`[notifySuccess] suppressed success notification for action='${action}', title='${title || ''}'`);
      }
      return null;
    }

    const displayTitle = title || map[a];
    return Toast.fire({ icon: 'success', title: displayTitle, text });
  } catch (err) {
    // Fallback to existing toast on unexpected errors
    try { return Toast.fire({ icon: 'success', title: title || 'Success', text }); } catch (e) { return null; }
  }
};

export const modalAlert = (title, text, icon = 'info') => Swal.fire({ icon, title, text });
export const modalConfirm = (opts) => Swal.fire(opts);

export default Swal;
