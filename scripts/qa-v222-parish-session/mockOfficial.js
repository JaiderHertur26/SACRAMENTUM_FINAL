import {deferred,record} from './mockServiceHelper.js';
export const listOfficialNotifications=id=>deferred('official',id);
export const markOfficialNotificationRead=async id=>record('read-official',id);