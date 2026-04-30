import { getBusinessCentralItemsPageData } from "@/app/actions/businessCentralItems";
import { getCurrentUser } from "@/app/actions/users";
import { ItemsClient } from "@/components/items/ItemsClient";
import { User } from "@/types/database";
import {
  mockConnectionStates,
  mockItems,
  mockReferenceData,
  mockSyncEvents,
  mockSyncProgress,
} from "@/lib/businessCentral/mockItems";
import {
  ConnectionState,
  SyncProgressState,
} from "@/types/businessCentralItems";

export const dynamic = "force-dynamic";

type ItemsPageSearchParams = Promise<{
  state?: string | string[];
}>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: ItemsPageSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const demoState = firstParam(params?.state);

  let user: User | null = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Failed to load current user for items page:", error);
  }

  if (demoState) {
    return <DemoItemsPage demoState={demoState} user={user} />;
  }

  const data = await getItemsPageDataOrError();
  return <ItemsClient {...data} initialUser={user} />;
}

async function getItemsPageDataOrError() {
  try {
    return await getBusinessCentralItemsPageData();
  } catch (error) {
    console.error("Failed to load Business Central items page data:", error);
    return {
      items: [],
      events: [],
      connection: {
        kind: "error" as const,
        environment: process.env.BUSINESS_CENTRAL_ENVIRONMENT ?? "unknown",
        companyId: process.env.BUSINESS_CENTRAL_DEFAULT_COMPANY_ID ?? "unknown",
        companyName: null,
        lastError:
          error instanceof Error
            ? error.message
            : "Failed to load Business Central items",
        lastVerifiedAt: null,
        lastPulledAt: null,
      },
      syncProgress: mockSyncProgress,
      references: mockReferenceData,
    };
  }
}

function DemoItemsPage({
  demoState,
  user,
}: {
  demoState: string;
  user: User | null;
}) {
  let connection: ConnectionState = mockConnectionStates.configuredOk;
  let items = mockItems;
  let events = mockSyncEvents;
  let syncProgress: SyncProgressState = mockSyncProgress;
  const references = mockReferenceData;
  let isLoading = false;

  switch (demoState) {
    case "not-configured":
      connection = mockConnectionStates.notConfigured;
      items = [];
      events = [];
      break;
    case "empty":
      items = [];
      events = [];
      break;
    case "error":
      connection = mockConnectionStates.errorState;
      items = [];
      events = [];
      break;
    case "syncing":
      syncProgress = {
        inProgress: true,
        byUserId: "user-1",
        byUserLabel: "Alex Admin",
        since: "2026-04-22T08:15:00Z",
      };
      break;
    case "loading":
      isLoading = true;
      items = [];
      events = [];
      break;
  }

  return (
    <ItemsClient
      items={items}
      events={events}
      connection={connection}
      syncProgress={syncProgress}
      references={references}
      initialUser={user}
      isLoading={isLoading}
    />
  );
}
