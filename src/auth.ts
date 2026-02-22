import path from 'path';
import { Request, Response, NextFunction } from 'express';
import config from './config';
import logger from './services/logger';

// serve login page
export function loginPage(req: Request, res: Response): void {
  // redirect to upload if already authenticated
  if (req.session?.authenticated) {
    res.redirect('/');
    return;
  }

  const filePath = path.join(__dirname, 'public', 'login.html');
  res.sendFile(filePath);
}

// handle login form submission
export function login(req: Request, res: Response): void {
  const log = logger.get();
  const { password } = req.body as { password?: string };

  if (password === config.uploadPassword) {
    req.session.authenticated = true;
    log.loginSuccess();
    res.json({ success: true, redirect: '/' });
    return;
  }

  log.loginFailed();
  res.status(401).json({ success: false, error: 'Invalid password' });
}

// middleware to require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) {
    next();
    return;
  }

  // for API requests, return JSON error
  const acceptHeader = req.headers.accept || '';
  if (req.xhr || acceptHeader.includes('application/json')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // for page requests, redirect to login
  res.redirect('/login');
}

export default {
  loginPage,
  login,
  requireAuth,
};
