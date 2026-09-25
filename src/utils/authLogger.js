import { ROLE_TYPES } from '@/config/supabaseConfig';

/**
 * Utility to log authentication events with styled console output.
 * Helps in debugging permissions and user context issues.
 */
export const logAuthEvent = (user, eventType = 'AUTH_EVENT') => {
  if (!user) return;

  const timestamp = new Date().toLocaleTimeString();
  const role = user.role || 'unknown';
  const name = user.username || user.email || 'Unknown User';
  const context = user.parishName || user.dioceseName || 'Global Context';
  const id = user.id || 'No ID';

  // CSS Styles for console
  const styles = {
    badge: 'background: #2563eb; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;',
    roleTag: 'background: #7c3aed; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-left: 5px;',
    key: 'color: #64748b; font-weight: normal; margin-right: 4px;',
    value: 'color: #0f172a; font-weight: bold;',
    sub: 'color: #94a3b8; font-size: 10px; font-style: italic;'
  };

  const emojiMap = {
    'LOGIN_SUCCESS': '🚀',
    'SESSION_RESTORED': '🔄',
    'CONTEXT_LOADED': '📂',
    'LOGOUT': '👋',
    'AUTH_ERROR': '❌'
  };

  const emoji = emojiMap[eventType] || '🔐';

  console.groupCollapsed(
    `%c${emoji} ${eventType}%c ${name}`, 
    styles.badge, 
    'font-weight: bold; margin-left: 8px; color: #1e293b;'
  );
  
  console.log(`%cRole%c${role.toUpperCase()}`, styles.key, styles.roleTag);
  
  // Validate Role against standardized types
  const isValidRole = Object.values(ROLE_TYPES).includes(role);
  if (!isValidRole) {
      console.warn(`⚠️ Warning: Role '${role}' does not match standard ROLE_TYPES.`);
  }

  console.log(`%cID%c${id}`, styles.key, styles.value);
  console.log(`%cContext%c${context}`, styles.key, styles.value);
  
  if (user.email) {
    console.log(`%cEmail%c${user.email}`, styles.key, styles.value);
  }

  console.log(`%cTimestamp: ${timestamp}`, styles.sub);
  console.log('%cFull Object:', styles.sub, user);
  
  console.groupEnd();
};