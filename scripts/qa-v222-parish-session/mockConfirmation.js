import {deferred,record} from './mockServiceHelper.js';
export const loadConfirmationNotificationContext=({parishId})=>deferred('confirmation',parishId);
export const issueConfirmationNotification=async args=>{record('issue',args);return {document_number:'QA-DOC'};};