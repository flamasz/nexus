'use client';

import { useEffect, useState } from 'react';

import { getBcCredentials, upsertBcCredentials } from '@/app/actions/businessCentralConnections';

const INPUT_CLASS =
  'w-full px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent';

export function BcCredentialsCard() {
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [defaultApiBaseUrl, setDefaultApiBaseUrl] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getBcCredentials()
      .then((data) => {
        if (!active || !data) return;
        setTenantId(data.tenantId);
        setClientId(data.clientId);
        setCompanyId(data.companyId ?? '');
        setCompanyName(data.companyName ?? '');
        setDefaultApiBaseUrl(data.defaultApiBaseUrl ?? '');
        setHasSecret(data.hasSecret);
      })
      .catch((err) => {
        if (active) {
          console.error('Failed to load Business Central credentials:', err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setError('');
    if (!tenantId.trim() || !clientId.trim()) {
      setError('Tenant ID and Client ID are required');
      return;
    }
    if (!companyId.trim()) {
      setError('Company ID is required');
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await upsertBcCredentials({
        tenantId,
        clientId,
        companyId,
        // Blank secret is intentional — it keeps the existing Vault secret.
        clientSecret: clientSecret.trim() === '' ? null : clientSecret,
        defaultApiBaseUrl,
      });
      // The secret is never echoed back; clear the input and mark it stored.
      if (clientSecret.trim() !== '') {
        setHasSecret(true);
        setClientSecret('');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save Business Central credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-border shadow-sm mt-6">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Business Central Credentials</h2>
        <p className="text-sm text-foreground-muted mt-0.5">
          The shared app registration used to connect to every Business Central environment.
        </p>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <p className="text-sm text-foreground-muted">Loading...</p>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-destructive-subtle border border-destructive/30 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="bcTenantId" className="block text-sm font-medium text-foreground mb-1">
                  Tenant ID
                </label>
                <input
                  id="bcTenantId"
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Azure AD tenant GUID"
                />
              </div>

              <div>
                <label htmlFor="bcClientId" className="block text-sm font-medium text-foreground mb-1">
                  Client ID
                </label>
                <input
                  id="bcClientId"
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="App registration client GUID"
                />
              </div>

              <div>
                <label htmlFor="bcClientSecret" className="block text-sm font-medium text-foreground mb-1">
                  Client Secret
                </label>
                <input
                  id="bcClientSecret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder={hasSecret ? '•••••••••• (leave blank to keep current)' : 'Enter the client secret'}
                  autoComplete="new-password"
                />
                <p className="text-xs text-foreground-subtle mt-1">
                  {hasSecret
                    ? 'A client secret is stored. Leave this blank to keep it, or enter a new value to rotate it.'
                    : 'No client secret is stored yet.'}
                </p>
              </div>

              <div>
                <label htmlFor="bcCompanyId" className="block text-sm font-medium text-foreground mb-1">
                  Company ID
                </label>
                <input
                  id="bcCompanyId"
                  type="text"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Business Central company GUID"
                />
                <p className="text-xs text-foreground-subtle mt-1">
                  {companyName
                    ? `Shared across every environment. Current company: ${companyName}.`
                    : 'The Business Central company shared across every environment.'}
                </p>
              </div>

              <div>
                <label htmlFor="bcDefaultApiBaseUrl" className="block text-sm font-medium text-foreground mb-1">
                  Default API Base URL <span className="text-foreground-subtle">(optional)</span>
                </label>
                <input
                  id="bcDefaultApiBaseUrl"
                  type="text"
                  value={defaultApiBaseUrl}
                  onChange={(e) => setDefaultApiBaseUrl(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://api.businesscentral.dynamics.com"
                />
              </div>

              <div className="pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm rounded-md transition-colors"
                >
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
