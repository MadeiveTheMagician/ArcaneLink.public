import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useRef } from 'react';

import { readJsonResponse } from '../../shared/api/api';
import type { LoginResponse, UserResponse } from '../../shared/types';
import { authCopy } from '../../system/shared';
import { AuthAccountFlow } from './account/AuthAccountFlow';
import {
  type AuthAccountAction,
  hasApiErrorCode
} from './account/accountActionModel';
import { isRegisterStepComplete } from './registration/AuthPageValidation';
import {
  AuthCopy,
  AuthLoginForm,
  type AuthMessage,
  AuthMessageView,
  type AuthMode,
  AuthModeSwitch,
  AuthRegisterForm,
  type AuthView,
  type LoginForm,
  type RegisterForm,
  registerSteps
} from './shell/AuthPageParts';
import { authFontOptions, defaultAuthFontId } from './theme/AuthFonts';

import artStyles from './shell/AuthArt.module.css';
import shellStyles from './shell/AuthShell.module.css';

type AuthPageProps = {
  onAuthenticated: (loginResponse: LoginResponse) => Promise<void>;
  accountAction?: AuthAccountAction | null;
  onAccountActionSettled?: () => void;
  onAccountActionExit?: () => void;
  onRequiresReauthentication?: () => void;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function detectDeviceName() {
  const typedNavigator = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const platform =
    typedNavigator.userAgentData?.platform ||
    navigator.platform ||
    'Unknown OS';
  const userAgent = navigator.userAgent;
  const browser = userAgent.includes('Edg/')
    ? 'Edge'
    : userAgent.includes('Chrome/')
      ? 'Chrome'
      : userAgent.includes('Firefox/')
        ? 'Firefox'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Browser';

  return `${platform} / ${browser}`;
}

const loginHint = authCopy.hints.deviceReady;
const registerHint = authCopy.hints.registerReady;

export function AuthPage({
  onAuthenticated,
  accountAction = null,
  onAccountActionSettled = () => undefined,
  onAccountActionExit = () => undefined,
  onRequiresReauthentication = () => undefined
}: AuthPageProps) {
  const artLayerRef = useRef<HTMLDivElement | null>(null);
  const transitionSurfaceRef = useRef<HTMLDivElement | null>(null);
  const deviceName = useMemo(() => detectDeviceName(), []);
  const [view, setView] = useState<AuthView>(
    () => accountAction?.kind ?? 'login'
  );
  const mode: AuthMode = view === 'register' ? 'register' : 'login';
  const [loginForm, setLoginForm] = useState<LoginForm>({
    loginOrEmail: '',
    password: '',
    deviceName
  });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    login: '',
    displayName: '',
    email: '',
    password: ''
  });
  const [verificationEmail, setVerificationEmail] = useState('');
  const [message, setMessage] = useState<AuthMessage>({
    tone: 'neutral',
    text: loginHint
  });
  const selectedFontId = defaultAuthFontId;
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const selectedFont =
    authFontOptions.find((font) => font.id === selectedFontId) ??
    authFontOptions[0];
  const authPageStyle = {
    '--auth-fantasy-font': selectedFont.stack
  } as CSSProperties & Record<'--auth-fantasy-font', string>;
  const registerProgress = registerSteps.map((step) =>
    isRegisterStepComplete(registerForm, step.key)
  );
  const nextIncompleteRegisterStep = registerProgress.findIndex(
    (isComplete) => !isComplete
  );
  const activeRegisterStep =
    nextIncompleteRegisterStep === -1
      ? registerSteps.length - 1
      : nextIncompleteRegisterStep;

  useEffect(() => {
    if (accountAction) {
      setView(accountAction.kind);
    }
  }, [accountAction]);

  async function animateModeSwitch(nextMode: AuthMode) {
    const surface = transitionSurfaceRef.current;
    const artLayer = artLayerRef.current;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!surface || prefersReducedMotion) {
      setView(nextMode);
      setMessage({
        tone: 'neutral',
        text: nextMode === 'login' ? loginHint : registerHint
      });
      return;
    }

    const outDirection = nextMode === 'register' ? -1 : 1;
    const inDirection = -outDirection;
    const surfaceOut = surface.animate(
      [
        { opacity: 1, transform: 'translateX(0) scale(1)', filter: 'blur(0)' },
        {
          opacity: 0,
          transform: `translateX(${outDirection * 18}px) scale(.985)`,
          filter: 'blur(8px)'
        }
      ],
      {
        duration: 240,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'both'
      }
    );
    const artOut = artLayer?.animate(
      [
        { opacity: 0.96, transform: 'translateX(0)' },
        { opacity: 0.62, transform: `translateX(${outDirection * -18}px)` }
      ],
      {
        duration: 320,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'both'
      }
    );

    await Promise.allSettled([
      surfaceOut.finished,
      artOut?.finished ?? Promise.resolve()
    ]);

    setView(nextMode);
    setMessage({
      tone: 'neutral',
      text: nextMode === 'login' ? loginHint : registerHint
    });

    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const surfaceIn = surface.animate(
      [
        {
          opacity: 0,
          transform: `translateX(${inDirection * 18}px) scale(.985)`,
          filter: 'blur(8px)'
        },
        { opacity: 1, transform: 'translateX(0) scale(1)', filter: 'blur(0)' }
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'both'
      }
    );
    const artIn = artLayer?.animate(
      [
        { opacity: 0.62, transform: `translateX(${inDirection * -14}px)` },
        { opacity: 0.96, transform: 'translateX(0)' }
      ],
      {
        duration: 420,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'both'
      }
    );

    await Promise.allSettled([
      surfaceIn.finished,
      artIn?.finished ?? Promise.resolve()
    ]);
  }

  async function switchMode(nextMode: AuthMode) {
    if (nextMode === mode || isSwitchingMode) {
      return;
    }

    setIsSwitchingMode(true);
    try {
      await animateModeSwitch(nextMode);
    } finally {
      setIsSwitchingMode(false);
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage({
      tone: 'neutral',
      text: authCopy.messages.verifyingAccessSeal
    });

    try {
      const [response] = await Promise.all([
        fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(loginForm)
        }),
        wait(520)
      ]);
      const loginResponse = await readJsonResponse<LoginResponse>(response);

      setMessage({
        tone: 'success',
        text: authCopy.messages.loginSuccess(loginResponse.displayName)
      });
      await wait(260);
      await onAuthenticated(loginResponse);
    } catch (error) {
      if (hasApiErrorCode(error, 'email_not_confirmed')) {
        setVerificationEmail(
          loginForm.loginOrEmail.includes('@') ? loginForm.loginOrEmail : ''
        );
        setView('verify-email');
        setMessage({
          tone: 'error',
          text: authCopy.messages.emailNotConfirmed
        });
        return;
      }

      setMessage({
        tone: 'error',
        text:
          error instanceof Error ? error.message : authCopy.messages.loginFailed
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage({ tone: 'neutral', text: authCopy.actions.creatingSeal });

    try {
      const [response] = await Promise.all([
        fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(registerForm)
        }),
        wait(520)
      ]);
      const user = await readJsonResponse<UserResponse>(response);

      setLoginForm({
        loginOrEmail: user.login,
        password: '',
        deviceName: loginForm.deviceName
      });
      setVerificationEmail(user.email);
      setView('verify-email');
      setMessage({
        tone: 'success',
        text: authCopy.messages.registerSuccess(user.login)
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : authCopy.messages.registerFailed
      });
    } finally {
      setIsLoading(false);
    }
  }

  function backToLogin() {
    setView('login');
    setMessage({ tone: 'neutral', text: loginHint });

    if (accountAction) {
      onAccountActionExit();
    }
  }

  return (
    <main
      className={`${shellStyles.authPage} ${
        view === 'register'
          ? shellStyles.authPageRegister
          : shellStyles.authPageLogin
      }`}
      style={authPageStyle}
    >
      <div
        ref={artLayerRef}
        className={artStyles.authArtLayer}
        aria-hidden="true"
      />
      <section className={shellStyles.authPanel} aria-labelledby="auth-title">
        {(view === 'login' || view === 'register') && (
          <AuthModeSwitch
            mode={mode}
            isSwitchingMode={isSwitchingMode}
            onSwitchMode={(nextMode) => void switchMode(nextMode)}
          />
        )}

        <div
          ref={transitionSurfaceRef}
          className={shellStyles.authTransitionSurface}
        >
          <AuthCopy view={view} />

          {view === 'login' ? (
            <AuthLoginForm
              loginForm={loginForm}
              isLoading={isLoading}
              onSubmit={submitLogin}
              onChange={setLoginForm}
              onForgotPassword={() => {
                setView('forgot-password');
                setMessage({ tone: 'neutral', text: '' });
              }}
            />
          ) : view === 'register' ? (
            <AuthRegisterForm
              registerForm={registerForm}
              registerProgress={registerProgress}
              activeRegisterStep={activeRegisterStep}
              isLoading={isLoading}
              onSubmit={submitRegister}
              onChange={setRegisterForm}
            />
          ) : (
            <AuthAccountFlow
              key={`${view}:${accountAction?.token ?? verificationEmail}`}
              view={view}
              token={accountAction?.token}
              initialEmail={verificationEmail || loginForm.loginOrEmail}
              onBackToLogin={backToLogin}
              onAccountActionSettled={onAccountActionSettled}
              onRequiresReauthentication={onRequiresReauthentication}
            />
          )}

          {(view === 'login' || view === 'register') && (
            <AuthMessageView message={message} />
          )}
        </div>
      </section>
    </main>
  );
}
