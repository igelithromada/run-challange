// Isolated sandbox only: no production Firebase configuration, connection or credentials.
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { sandboxAuth } from '../sandbox/auth';
import { installSandboxFetch } from '../sandbox/transport';
installSandboxFetch();
export const auth = sandboxAuth as Auth;
export const db = {} as Firestore;
export const storage = {} as FirebaseStorage;
