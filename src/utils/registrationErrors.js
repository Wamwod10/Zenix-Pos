export function registrationFieldErrors(error){
  const field={USERNAME_EXISTS:'login',PHONE_EXISTS:'phone',TRIAL_ALREADY_USED:'phone'}[error?.code]||'form';
  return {[field]:error?.message||'Ro‘yxatdan o‘tib bo‘lmadi. Qayta urinib ko‘ring.'};
}
