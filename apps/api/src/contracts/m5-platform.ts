import {boundedText,exactObject} from './content';

export const M5_DELETION_SCOPE='all-active-tenant-data' as const;
export type M5QuotaMode='unset'|'monitor'|'enforced';
export type M5DeletionPhase='none'|'requested'|'confirmed'|'executing'|'failed'|'completed'|'cancelled';
export interface M5QuotaPolicy {mode:M5QuotaMode;contentItemsLimit:number|null;mediaBytesLimit:number|null}
export interface M5Usage {contentItems:number;storedMediaBytes:number;reservedMediaBytes:number;mediaAccounting:'confirmed-and-reserved'}
export interface M5Capabilities {read:boolean;export:boolean;businessWrite:boolean;safetyWrite:boolean}
export interface M5Deletion {requestId:string|null;phase:M5DeletionPhase;executeAfter:string|null;scope:typeof M5_DELETION_SCOPE|null;confirmed:boolean;failureCode:string|null;completedAt:string|null}
export interface M5PlatformStatus {tenantId:string;status:'active'|'suspended'|'deleting'|'deleted';version:number;policy:M5QuotaPolicy;usage:M5Usage;capabilities:M5Capabilities;deletion:M5Deletion;readinessWarnings:string[]}
export interface M5Command {operationId:string;expectedVersion:number;reason:string}
export interface M5QuotaCommand extends M5Command {policy:M5QuotaPolicy}
export interface M5LifecycleCommand extends M5Command {action:'suspend'|'reactivate'}
export interface M5DeletionRequest extends M5Command {tenantId:string;scope:typeof M5_DELETION_SCOPE;executeAfter:string}
export interface M5DeletionConfirmation extends M5DeletionRequest {requestId:string}
export interface M5DeletionExecution extends M5Command {requestId:string}
export interface M5CommandResult {operationId:string;replayed:boolean;status:M5PlatformStatus}
export type M5FailureCode='INVALID_INPUT'|'VERSION_CONFLICT'|'OPERATION_CONFLICT'|'REAUTH_REQUIRED'|'QUOTA_EXCEEDED'|'DELETION_UNAVAILABLE'|'CONFIRMATION_REQUIRED'|'EXECUTE_AFTER'|'IRREVERSIBLE'|'NOT_FOUND';
export interface M5ExportManifest {schemaVersion:1;exportId:string;tenantId:string;startedAt:string;completedAt:string;complete:true;consistency:'bounded-current-authorized-batches';restoreBackup:false;includeMedia:boolean;datasets:{name:string;records:number}[];media:{included:number;excluded:number;exclusionsFile:string};limits:string[]}

export const M5_PLATFORM_ROUTES={
 tenant:'/api/cms/tenants/:tenant/m5/platform',
 request:'/api/cms/tenants/:tenant/m5/platform/deletion/request',
 confirm:'/api/cms/tenants/:tenant/m5/platform/deletion/confirm',
 cancel:'/api/cms/tenants/:tenant/m5/platform/deletion/cancel',
 export:'/api/cms/tenants/:tenant/m5/platform/export',
 platform:'/api/platform/tenants/:tenant/m5',
 quota:'/api/platform/tenants/:tenant/m5/quota',
 lifecycle:'/api/platform/tenants/:tenant/m5/lifecycle',
 execute:'/api/platform/tenants/:tenant/m5/deletion/execute',
} as const;
function id(v:unknown){if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v))throw new TypeError('Invalid identity');return v;}
function base(v:Record<string,unknown>):M5Command {if(!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<0||Number(v.expectedVersion)>2147483646)throw new TypeError('Invalid version');return {operationId:id(v.operationId),expectedVersion:Number(v.expectedVersion),reason:boundedText(v.reason,500,true).trim()};}
function policy(input:unknown):M5QuotaPolicy {const p=exactObject(input,['mode','contentItemsLimit','mediaBytesLimit']);if(!['unset','monitor','enforced'].includes(String(p.mode)))throw new TypeError('Invalid mode');for(const k of ['contentItemsLimit','mediaBytesLimit']){if(p[k]!==null&&(!Number.isSafeInteger(p[k])||Number(p[k])<0))throw new TypeError('Invalid limit');}if(p.mode==='enforced'&&p.contentItemsLimit===null&&p.mediaBytesLimit===null)throw new TypeError('Explicit enforced dimension required');if(p.mode==='unset'&&(p.contentItemsLimit!==null||p.mediaBytesLimit!==null))throw new TypeError('Unset limits must be explicit null');return p as unknown as M5QuotaPolicy;}
export function parseM5Quota(input:unknown):M5QuotaCommand{const v=exactObject(input,['operationId','expectedVersion','reason','policy']);return {...base(v),policy:policy(v.policy)};}
export function parseM5InitialQuotaPolicy(input:unknown):M5QuotaPolicy&{mode:'monitor'|'enforced'}{const result=policy(input);if(result.mode==='unset')throw new TypeError('Explicit initial quota mode required');return result as M5QuotaPolicy&{mode:'monitor'|'enforced'};}
export function parseM5Lifecycle(input:unknown):M5LifecycleCommand{const v=exactObject(input,['operationId','expectedVersion','reason','action']);if(v.action!=='suspend'&&v.action!=='reactivate')throw new TypeError('Invalid action');return {...base(v),action:v.action};}
export function parseM5Deletion(input:unknown,type:'request'|'confirm'|'cancel'|'execute'):M5DeletionRequest|M5DeletionConfirmation|M5DeletionExecution|M5Command{const keys=['operationId','expectedVersion','reason',...(type==='request'||type==='confirm'?['tenantId','scope','executeAfter']:[]),...(type==='confirm'||type==='execute'?['requestId']:[])];const v=exactObject(input,keys),b=base(v);if(type==='cancel')return b;if(type==='execute')return {...b,requestId:id(v.requestId)};if(v.scope!==M5_DELETION_SCOPE||typeof v.executeAfter!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.executeAfter)||!Number.isFinite(Date.parse(v.executeAfter))||new Date(v.executeAfter).toISOString()!==v.executeAfter)throw new TypeError('Invalid deletion scope/time');return {...b,tenantId:id(v.tenantId),scope:M5_DELETION_SCOPE,executeAfter:v.executeAfter,...(type==='confirm'?{requestId:id(v.requestId)}:{})};}
export function m5Capabilities(status:M5PlatformStatus['status']):M5Capabilities {const read=status==='active'||status==='suspended';return {read,export:read,businessWrite:status==='active',safetyWrite:read};}
