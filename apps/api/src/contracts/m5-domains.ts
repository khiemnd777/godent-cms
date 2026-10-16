/** S16 local domain contracts. Synthetic evidence never proves live DNS or TLS. */
export interface M5DomainBinding {id:string;tenantId:string;host:string;state:'pending'|'active'|'inactive'|'removed';tls:'unknown'|'valid'|'invalid';generation:number;version:number;verifiedAt:string|null;tlsExpiresAt:string|null;origin:string|null}
export interface M5Primary {mode:'godent'|'custom';bindingId:string|null;version:number;origin:string;basePath:string}
export interface M5DomainReadiness {ready:boolean;issues:string[];eligiblePages:number}
export interface M5DomainsView {bindings:M5DomainBinding[];primary:M5Primary;readiness:M5DomainReadiness;nextCursor:string|null}
export interface M5DomainCommandResult extends M5DomainsView {operationId:string;replayed:boolean;bindingId:string|null;appliedPrimaryVersion:number}
export interface M5RegisterDomainInput {operationId:string;host:string}
export interface M5VerifyDomainInput {operationId:string;expectedVersion:number}
export interface M5ChangeDomainInput extends M5VerifyDomainInput {expectedPrimaryVersion:number;reason:string}
export type M5PrimaryInput={operationId:string;expectedPrimaryVersion:number;mode:'custom';bindingId:string;expectedBindingVersion:number;reason:string}|{operationId:string;expectedPrimaryVersion:number;mode:'godent';reason:string;acknowledgeCachedRedirects:true};
export interface M5EntryContext {tenantId:string;siteId:string;tenantSlug:string;entry:{mode:'platform'|'custom';origin:string;basePath:string;bindingId:string|null;generation:number};primary:M5Primary;sitePagePath:string}
export interface M5VerificationEvidence {bindingId:string;tenantId:string;siteId:string;host:string;generation:number;adapter:'synthetic-local';tls:'valid';origin:string;verifiedAt:string;expiresAt:string}
export interface M5LocalVerifierConfig {mode:string;bindings:{tenantId:string;host:string}[]}
const base=(tenant:string)=>`/api/tenants/${encodeURIComponent(tenant)}/domains`;
export const M5_DOMAIN_ROUTES={list:base,register:base,readiness:(t:string)=>`${base(t)}/readiness`,primary:(t:string)=>`${base(t)}/primary`,verify:(t:string,id:string)=>`${base(t)}/${encodeURIComponent(id)}/verify-local`,change:(t:string,id:string,action:'deactivate'|'remove'|'reverify')=>`${base(t)}/${encodeURIComponent(id)}/${action}`,entry:(host:string,path:string)=>`/api/public/entry?${new URLSearchParams({host,path})}`} as const;
