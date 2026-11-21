const sdk = 'https://www.gstatic.com/firebasejs/13.4.0/';

export async function connectAuth() {
  const response = await fetch(new URL('./auth-config.json', import.meta.url));
  if (!response.ok) throw new Error('Configuración de Firebase no disponible');
  const { firebaseConfig, appleEnabled } = await response.json();
  if (!['apiKey', 'authDomain', 'projectId', 'appId'].every(key => firebaseConfig?.[key])) {
    throw new Error('Configuración de Firebase incompleta');
  }
  const [{ initializeApp }, api] = await Promise.all([
    import(sdk + 'firebase-app.js'),
    import(sdk + 'firebase-auth.js'),
  ]);
  const auth = api.getAuth(initializeApp(firebaseConfig));
  await api.setPersistence(auth, api.browserLocalPersistence);
  await auth.authStateReady();

  function signInWithApple() {
    const provider = new api.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return api.signInWithPopup(auth, provider);
  }

  return {
    get user() { return auth.currentUser; },
    subscribe: listener => api.onAuthStateChanged(auth, listener),
    appleEnabled: appleEnabled === true,
    google: () => api.signInWithPopup(auth, new api.GoogleAuthProvider()),
    apple: appleEnabled === true ? signInWithApple : null,
    signIn: (email, password) => api.signInWithEmailAndPassword(auth, email, password),
    passwordIsValid: async password => (await api.validatePassword(auth, password)).isValid,
    async register(name, email, password) {
      const { user } = await api.createUserWithEmailAndPassword(auth, email, password);
      const results = await Promise.allSettled([
        api.updateProfile(user, { displayName: name }),
        api.sendEmailVerification(user),
      ]);
      return {
        nameSaved: results[0].status === 'fulfilled',
        verificationSent: results[1].status === 'fulfilled',
      };
    },
    reset: email => api.sendPasswordResetEmail(auth, email),
    verify: () => api.sendEmailVerification(auth.currentUser),
    refresh: () => api.reload(auth.currentUser),
    signOut: () => api.signOut(auth),
  };
}
