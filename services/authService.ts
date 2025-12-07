import { User, UserRole } from '../types';

const STORAGE_KEY_USERS = 'recost_users';
const STORAGE_KEY_CURRENT_USER = 'recost_current_user';

// Default Admin User
const DEFAULT_ADMIN: User = {
  id: 'admin-1',
  email: 'admin@recost.ai',
  name: 'Główny Administrator',
  role: 'ADMIN',
};

export const authService = {
  // Simulate login
  login: async (email: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Check if it's the default admin
        if (email === DEFAULT_ADMIN.email) {
          localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(DEFAULT_ADMIN));
          resolve(DEFAULT_ADMIN);
          return;
        }

        // Check created users
        const users = authService.getSubUsers();
        const foundUser = users.find(u => u.email === email);

        if (foundUser) {
          localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(foundUser));
          resolve(foundUser);
        } else {
          // For demo purposes, if email contains "admin", log as admin, else create temp user
          // In real app, this would reject.
          if (email.includes('admin')) {
             const newAdmin: User = { id: Date.now().toString(), email, name: 'Admin', role: 'ADMIN' };
             localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(newAdmin));
             resolve(newAdmin);
          } else {
             reject(new Error("Użytkownik nie istnieje. Skontaktuj się z administratorem."));
          }
        }
      }, 800);
    });
  },

  loginWithGoogle: async (): Promise<User> => {
     return new Promise((resolve) => {
        setTimeout(() => {
           // Simulate Google Auth returning the default admin for demo convenience
           // or a new user based on randomization
           const isLuck = Math.random() > 0.5;
           const user = isLuck ? DEFAULT_ADMIN : {
               id: 'google-user-1',
               email: 'user@gmail.com',
               name: 'Pracownik Google',
               role: 'USER' as UserRole
           };
           localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
           resolve(user);
        }, 1000);
     });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    return stored ? JSON.parse(stored) : null;
  },

  // User Management (For Admin)
  getSubUsers: (): User[] => {
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    return stored ? JSON.parse(stored) : [];
  },

  createSubUser: (email: string, name: string): User => {
    const users = authService.getSubUsers();
    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      role: 'USER', // Always create as restricted user
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    return newUser;
  },

  removeSubUser: (id: string) => {
    const users = authService.getSubUsers();
    const filtered = users.filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(filtered));
  }
};