import { EventEmitter } from 'events';
import { RegisteredAsset } from './AssetRegistry';

interface AccessPolicy {
  id: string;
  assetId: string;
  allowedUsers: string[];
  allowedGroups: string[];
  defaultPermissions: string[];
  constraints?: {
    maxUsers?: number;
    timeLimit?: number;
    usageLimit?: number;
  };
}

interface AccessGrant {
  id: string;
  user: string;
  assetId: string;
  permissions: string[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AccessRequest {
  id: string;
  user: string;
  assetId: string;
  requestedPermissions: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export class AccessManager extends EventEmitter {
  private grants: Map<string, AccessGrant> = new Map();
  private requests: Map<string, AccessRequest> = new Map();
  private policies: Map<string, AccessPolicy> = new Map();
  private usageTracking: Map<string, Map<string, number>> = new Map(); // assetId -> userId -> usage count

  constructor() {
    super();
  }

  async grantAccess(
    user: string,
    assetId: string,
    permissions: string[] = ['read'],
    options?: {
      expiresIn?: number;  // Duration in milliseconds
      checkPolicy?: boolean;
    }
  ): Promise<string> {
    try {
      // Check if policy allows access
      if (options?.checkPolicy) {
        const policy = this.policies.get(assetId);
        if (policy) {
          if (!this.isPolicyAllowed(user, policy, permissions)) {
            throw new Error('Access not allowed by policy');
          }
        }
      }

      const grantId = this.generateGrantId();
      const grant: AccessGrant = {
        id: grantId,
        user,
        assetId,
        permissions,
        expiresAt: options?.expiresIn ? new Date(Date.now() + options.expiresIn) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.grants.set(grantId, grant);

      this.emit('accessGranted', {
        grantId,
        user,
        assetId,
        permissions,
        timestamp: new Date()
      });

      return grantId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async revokeAccess(grantId: string): Promise<void> {
    try {
      const grant = this.grants.get(grantId);
      if (!grant) {
        throw new Error('Grant not found');
      }

      this.grants.delete(grantId);

      this.emit('accessRevoked', {
        grantId,
        user: grant.user,
        assetId: grant.assetId,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async requestAccess(
    user: string,
    assetId: string,
    permissions: string[] = ['read']
  ): Promise<string> {
    try {
      const requestId = this.generateRequestId();
      const request: AccessRequest = {
        id: requestId,
        user,
        assetId,
        requestedPermissions: permissions,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.requests.set(requestId, request);

      this.emit('accessRequested', {
        requestId,
        user,
        assetId,
        permissions,
        timestamp: new Date()
      });

      return requestId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async approveRequest(requestId: string): Promise<string> {
    try {
      const request = this.requests.get(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request is not pending');
      }

      // Grant access
      const grantId = await this.grantAccess(
        request.user,
        request.assetId,
        request.requestedPermissions
      );

      // Update request status
      request.status = 'approved';
      request.updatedAt = new Date();

      this.emit('requestApproved', {
        requestId,
        grantId,
        user: request.user,
        assetId: request.assetId,
        timestamp: new Date()
      });

      return grantId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async rejectRequest(requestId: string): Promise<void> {
    try {
      const request = this.requests.get(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request is not pending');
      }

      request.status = 'rejected';
      request.updatedAt = new Date();

      this.emit('requestRejected', {
        requestId,
        user: request.user,
        assetId: request.assetId,
        timestamp: new Date()
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async createPolicy(
    assetId: string,
    policy: Omit<AccessPolicy, 'id'>
  ): Promise<string> {
    try {
      const policyId = this.generatePolicyId();
      const newPolicy: AccessPolicy = {
        id: policyId,
        ...policy,
        assetId
      };

      this.policies.set(policyId, newPolicy);

      this.emit('policyCreated', {
        policyId,
        assetId,
        timestamp: new Date()
      });

      return policyId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async checkAccess(
    user: string,
    assetId: string,
    requiredPermissions: string[] = ['read']
  ): Promise<boolean> {
    try {
      // Check all grants for this user and asset
      for (const grant of this.grants.values()) {
        if (grant.user === user && grant.assetId === assetId) {
          // Check if grant is expired
          if (grant.expiresAt && grant.expiresAt < new Date()) {
            continue;
          }

          // Check if all required permissions are granted
          if (requiredPermissions.every(p => grant.permissions.includes(p))) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async trackUsage(user: string, assetId: string): Promise<void> {
    let assetUsage = this.usageTracking.get(assetId);
    if (!assetUsage) {
      assetUsage = new Map();
      this.usageTracking.set(assetId, assetUsage);
    }

    const currentUsage = assetUsage.get(user) || 0;
    assetUsage.set(user, currentUsage + 1);

    // Check usage limits from policy
    const policy = this.policies.get(assetId);
    if (policy?.constraints?.usageLimit && currentUsage + 1 >= policy.constraints.usageLimit) {
      this.emit('usageLimitReached', {
        user,
        assetId,
        usage: currentUsage + 1,
        limit: policy.constraints.usageLimit,
        timestamp: new Date()
      });
    }
  }

  private isPolicyAllowed(
    user: string,
    policy: AccessPolicy,
    requestedPermissions: string[]
  ): boolean {
    // Check if user is explicitly allowed
    if (policy.allowedUsers.includes(user)) {
      return true;
    }

    // Check if user's groups are allowed
    // In a real implementation, this would check against a group membership service
    if (policy.allowedGroups.length > 0) {
      // For now, assume no group membership
      return false;
    }

    // Check if requested permissions are included in default permissions
    return requestedPermissions.every(p => policy.defaultPermissions.includes(p));
  }

  private generateGrantId(): string {
    return 'grant_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateRequestId(): string {
    return 'req_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generatePolicyId(): string {
    return 'pol_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 