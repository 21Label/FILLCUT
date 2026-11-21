import { connectAuth } from './firebase-auth.mjs';

const trigger = document.getElementById('accountButton');
const dialog = document.getElementById('accountDialog');
const title = document.getElementById('accountTitle');
const logo = dialog.querySelector('.account-logo');
const content = document.getElementById('accountContent');
const error = document.getElementById('accountError');
const status = document.getElementById('accountStatus');
const localProfile = document.getElementById('profileDialog');

let account;
let loading;
let unavailable = false;
let busy = false;
let view = 'welcome';
let previousUid;

const authErrors = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/invalid-email': 'Escribe un correo electrónico válido.',
  'auth/invalid-credential': 'El correo o la contraseña son incorrectos.',
  'auth/wrong-password': 'El correo o la contraseña son incorrectos.',
  'auth/user-not-found': 'El correo o la contraseña son incorrectos.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/weak-password': 'La contraseña no cumple los requisitos de seguridad.',
  'auth/password-does-not-meet-requirements': 'La contraseña no cumple los requisitos de seguridad.',
  'auth/network-request-failed': 'Revisa tu conexión e inténtalo de nuevo.',
  'auth/too-many-requests': 'Hubo demasiados intentos. Espera un momento y vuelve a intentarlo.',
  'auth/popup-blocked': 'Permite las ventanas emergentes de FILLCUT y vuelve a intentarlo.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de inicio de sesión. Puedes volver a intentarlo.',
  'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este correo. Usa tu método de acceso anterior.',
  'auth/unauthorized-domain': 'El inicio de sesión aún no está habilitado en este dominio.',
  'auth/operation-not-allowed': 'Este método de acceso aún no está habilitado.',
};

function message(element, text = '') {
  element.textContent = text;
  element.hidden = !text;
}

function button(label, action, kind = '') {
  return `<button class="account-action ${kind}" type="button" data-action="${action}">${label}</button>`;
}

function render(nextView, focus = true) {
  view = nextView;
  message(error);
  message(status);
  const user = account?.user;
  if (view === 'profile' && user) {
    title.textContent = 'Mi perfil';
    content.innerHTML = `
      <img alt="" hidden>
      <p data-name></p>
      <p data-email></p>
      <p data-provider></p>
      <p data-verification hidden></p>
      <div class="account-actions">
        ${user.email && !user.emailVerified ? button('Reenviar correo de verificación', 'verify') + button('Actualizar estado de verificación', 'refresh') : ''}
        ${button('Cerrar sesión', 'signOut', 'account-primary')}
      </div>`;
    const labels = { 'google.com': 'Google', 'apple.com': 'Apple', password: 'Correo electrónico' };
    const providers = user.providerData.map(provider => labels[provider.providerId]).filter(Boolean);
    content.querySelector('[data-name]').textContent = user.displayName || 'Nombre sin configurar';
    content.querySelector('[data-email]').textContent = user.email || 'Correo sin configurar';
    content.querySelector('[data-provider]').textContent = providers.join(', ') || 'Cuenta FILLCUT';
    const verification = content.querySelector('[data-verification]');
    if (user.email) message(verification, user.emailVerified ? 'Correo verificado' : 'Correo pendiente de verificación');
    const photo = content.querySelector('img');
    if (user.photoURL?.startsWith('https://')) {
      photo.referrerPolicy = 'no-referrer';
      photo.addEventListener('error', () => { photo.hidden = true; }, { once: true });
      photo.hidden = false;
      photo.src = user.photoURL;
    }
  } else if (['signIn', 'register', 'reset'].includes(view)) {
    const registering = view === 'register';
    const resetting = view === 'reset';
    title.textContent = registering ? 'Crear cuenta' : resetting ? 'Recuperar contraseña' : 'Iniciar sesión con correo';
    content.innerHTML = `
      <form>
        ${registering ? '<label>Nombre<input name="name" autocomplete="name" maxlength="48" required></label>' : ''}
        <label>Correo electrónico<input name="email" type="email" autocomplete="email" autocapitalize="none" maxlength="254" required></label>
        ${resetting ? '' : `<label>Contraseña<input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" required></label>`}
        ${registering ? '<label>Confirmar contraseña<input name="confirmation" type="password" autocomplete="new-password" required></label>' : ''}
        <button class="account-action account-primary" type="submit">${registering ? 'Crear cuenta' : resetting ? 'Enviar correo de recuperación' : 'Iniciar sesión'}</button>
        ${view === 'signIn' ? button('Olvidé mi contraseña', 'reset', 'account-link') : ''}
        ${button('Volver', resetting ? 'signIn' : 'welcome', 'account-link')}
      </form>`;
  } else {
    view = 'welcome';
    title.textContent = 'Bienvenido a FILLCUT';
    content.innerHTML = `
      <p class="account-intro">Inicia sesión o crea una cuenta para guardar y gestionar tus proyectos.</p>
      <div class="account-actions">
        ${button('Continuar con Google', 'google', 'account-primary')}
        ${button('Continuar con Gmail', 'signIn')}
        ${button('Crear Cuenta', 'register')}
      </div>`;
    if (!account) {
      content.querySelectorAll('button').forEach(control => { control.disabled = true; });
      if (unavailable) message(error, 'No se pudo conectar. Cierra y vuelve a abrir la ventana para reintentar.');
    }
  }
  const welcome = view === 'welcome';
  dialog.classList.toggle('account-welcome', welcome);
  logo.hidden = !welcome;
  if (focus && dialog.open) title.focus();
}

function updateIdentity(user) {
  const label = user ? 'Mi perfil' : 'Iniciar sesión';
  trigger.querySelector('span').textContent = label;
  trigger.setAttribute('aria-label', label);
  trigger.title = label;
  const uid = user?.uid;
  if (uid !== previousUid && dialog.open) render(user ? 'profile' : 'welcome');
  previousUid = uid;
}

function initialize() {
  unavailable = false;
  if (!loading) {
    loading = connectAuth().then(service => {
      account = service;
      account.subscribe(updateIdentity);
      updateIdentity(account.user);
    }).catch(() => {
      unavailable = true;
      loading = undefined;
    }).finally(() => {
      if (dialog.open) render(account?.user ? 'profile' : 'welcome', false);
    });
  }
}

async function perform(operation, { refresh = false } = {}) {
  if (busy) return;
  busy = true;
  const controls = [...dialog.querySelectorAll('button, input')];
  controls.forEach(control => { control.disabled = true; });
  dialog.setAttribute('aria-busy', 'true');
  message(error);
  message(status);
  try {
    const notice = await operation();
    updateIdentity(account.user);
    if (refresh && account.user) render('profile', false);
    if (notice) message(status, notice);
  } catch (issue) {
    message(error, authErrors[issue.code] || issue.publicMessage || 'No se pudo completar la operación. Inténtalo de nuevo.');
  } finally {
    busy = false;
    dialog.removeAttribute('aria-busy');
    controls.forEach(control => { control.disabled = false; });
  }
}

function invalid(publicMessage) {
  throw Object.assign(new Error(publicMessage), { publicMessage });
}

trigger.addEventListener('click', () => {
  if (!loading) initialize();
  render(account?.user ? 'profile' : 'welcome', false);
  dialog.showModal();
  title.focus();
});

dialog.addEventListener('cancel', event => {
  if (busy) event.preventDefault();
});
dialog.addEventListener('close', () => {
  if (!dialog.open) content.replaceChildren();
});
dialog.addEventListener('click', event => {
  if (busy) return;
  const action = event.target.closest('button[data-action]')?.dataset.action;
  if (action === 'close' || event.target === dialog) dialog.close();
  if (action === 'local') {
    dialog.close();
    const input = document.getElementById('profileName');
    try { input.value = localStorage.getItem('trazo-profile-name') || ''; }
    catch { input.value = ''; }
    localProfile.showModal();
  }
  if (['welcome', 'signIn', 'register', 'reset'].includes(action)) render(action);
  if (!account) return;
  if (action === 'google' || action === 'apple') perform(() => account[action]().then(() => undefined));
  if (action === 'signOut') perform(() => account.signOut());
  if (action === 'verify') perform(async () => {
    await account.verify();
    return 'Revisa tu bandeja para verificar el correo.';
  });
  if (action === 'refresh') perform(async () => {
    await account.refresh();
    return account.user?.emailVerified ? 'Tu correo ya está verificado.' : 'La verificación sigue pendiente.';
  }, { refresh: true });
});

dialog.addEventListener('submit', event => {
  event.preventDefault();
  if (!account || busy) return;
  const form = event.target;
  const data = new FormData(form);
  const email = data.get('email').trim();
  const password = data.get('password');
  const currentView = view;
  perform(async () => {
    if (currentView === 'reset') {
      try { await account.reset(email); }
      catch (issue) { if (issue.code !== 'auth/user-not-found') throw issue; }
      return 'Si el correo está asociado a una cuenta, recibirás un enlace para restablecer la contraseña.';
    }
    if (currentView === 'signIn') {
      await account.signIn(email, password);
      return;
    }
    const name = data.get('name').trim();
    if (!name) invalid('Escribe tu nombre.');
    if (password !== data.get('confirmation')) invalid('Las contraseñas no coinciden.');
    if (!await account.passwordIsValid(password)) {
      invalid('La contraseña no cumple los requisitos de seguridad. Usa una más larga y combina letras, números y símbolos.');
    }
    const result = await account.register(name, email, password);
    const notices = [];
    if (!result.nameSaved) notices.push('La cuenta se creó, pero no se pudo guardar el nombre.');
    if (result.verificationSent) notices.push('Revisa tu bandeja para verificar el correo.');
    else notices.push('No se pudo enviar la verificación. Puedes solicitar otro correo desde tu perfil.');
    return notices.join(' ');
  }, { refresh: currentView === 'register' }).finally(() => {
    for (const field of form.querySelectorAll('input[type="password"]')) field.value = '';
  });
});

initialize();
