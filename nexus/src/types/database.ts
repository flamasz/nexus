export type UserRole = "user" | "admin";
export type DimensionUnit = "mm" | "cm" | "in";
export type UploadStatus = "uploaded" | "approved" | "rejected";
export type ItemStatus = "new" | "in_progress" | "approved" | "superceded";
export type ItemOrderStatus = "new" | "final" | "cancel";
export type ItemPriority = "1_critical" | "2_standard" | "3_low";
export type DesignerAccessLevel = "disabled" | "view" | "edit";
export type BusinessCentralSyncStatus =
  | "never_synced"
  | "synced"
  | "local_dirty"
  | "unpushed"
  | "syncing"
  | "failed"
  | "deleted_in_bc";
export type BusinessCentralSyncDirection =
  | "pull"
  | "push"
  | "create"
  | "delete"
  | "connection_test"
  | "reference_refresh";
export type BusinessCentralSyncEventStatus =
  | "success"
  | "failed"
  | "skipped"
  | "conflict_resolved";
export type BusinessCentralErrorClass =
  | "auth_failed"
  | "stale_etag"
  | "not_found"
  | "throttled"
  | "server_error"
  | "validation_error"
  | "network_error"
  | "conflict_resolved";

export interface FunctionalRoles {
  purchaser: boolean;
  vendor: boolean;
  designer: DesignerAccessLevel;
}

export interface PermissionOverrides {
  accessAdminPage?: boolean;
  manageUsers?: boolean;
  createOrder?: boolean;
  editOrderDate?: boolean;
  editOrderItems?: boolean;
  deleteOrderItems?: boolean;
  archiveOrders?: boolean;
  deleteOrders?: boolean;
  viewDesignerFields?: boolean;
  editDesignerFields?: boolean;
  openArtworkModal?: boolean;
  uploadArtwork?: boolean;
  manageUploadStatus?: boolean;
  editUploadNotes?: boolean;
  archiveUploadSessions?: boolean;
  deleteUploadSessions?: boolean;
  manageCatalog?: boolean;
  createPackagingItems?: boolean;
  editPackagingItems?: boolean;
  deletePackagingItems?: boolean;
}

export interface UserPermissions {
  functionalRoles: FunctionalRoles;
  overrides: PermissionOverrides;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  organization_id: string | null;
  permissions: UserPermissions | null;
  permissions_version: number;
  permissions_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface OrgMember {
  user_id: string;
  organization_id: string;
  role: string;
  created_at: string;
}

export interface OrgMemberWithOrg extends OrgMember {
  organization: Organization;
}

export interface Category {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  depth: number | null;
  unit: DimensionUnit;
  color: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductLine {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
}

export interface ItemName {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  item_name_id: string;
  category_id: string | null;
  product_line_id: string | null;
  version: string | null;
  status: ItemStatus;
  archived: boolean;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  bc_item_id: string | null;
}

export interface BusinessCentralConnection {
  id: string;
  organization_id: string;
  environment: string;
  company_id: string;
  company_name: string | null;
  api_base_url: string;
  sync_enabled: boolean;
  last_verified_at: string | null;
  last_error: string | null;
  last_pulled_at: string | null;
  sync_in_progress_by: string | null;
  sync_in_progress_since: string | null;
  sync_in_progress_timeout_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessCentralReferenceRow {
  id: string;
  organization_id: string;
  bc_id: string;
  code: string;
  display_name: string;
  is_active: boolean;
  last_modified_at: string | null;
  last_refreshed_at: string;
  created_at: string;
  updated_at: string;
}

export type BusinessCentralItemCategory = BusinessCentralReferenceRow;

export interface BusinessCentralTaxGroup extends BusinessCentralReferenceRow {
  tax_type: string | null;
}

export interface BusinessCentralUnitOfMeasure extends BusinessCentralReferenceRow {
  international_standard_code: string | null;
  symbol: string | null;
}

export interface BusinessCentralGeneralProductPostingGroup extends BusinessCentralReferenceRow {
  default_vat_product_posting_group: string | null;
  auto_insert_default: boolean | null;
}

export type BusinessCentralInventoryPostingGroup = BusinessCentralReferenceRow;

export interface BusinessCentralItem {
  id: string;
  organization_id: string;
  bc_connection_id: string | null;
  bc_environment: string;
  bc_company_id: string;
  bc_item_id: string;
  bc_item_number: string | null;
  bc_etag: string | null;
  bc_last_modified_at: string | null;
  display_name: string;
  display_name_2: string | null;
  type: string | null;
  item_category_id: string | null;
  item_category_code: string | null;
  blocked: boolean;
  gtin: string | null;
  inventory: number | null;
  unit_price: number | null;
  price_includes_tax: boolean;
  unit_cost: number | null;
  tax_group_id: string | null;
  tax_group_code: string | null;
  base_unit_of_measure_id: string | null;
  base_unit_of_measure_code: string | null;
  general_product_posting_group_id: string | null;
  general_product_posting_group_code: string | null;
  inventory_posting_group_id: string | null;
  inventory_posting_group_code: string | null;
  bc_raw_payload: Record<string, unknown>;
  sync_status: BusinessCentralSyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
  last_pulled_at: string | null;
  last_pushed_at: string | null;
  local_last_edited_at: string | null;
  local_last_edited_by: string | null;
  client_request_id: string | null;
  deleted_in_bc_at: string | null;
  delete_confirmed_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessCentralItemDetails {
  item_id: string;
  artwork_status: string | null;
  net_weight_grams: number | null;
  net_weight_oz: number | null;
  sams_club_item_number: string | null;
  units_per_case: number | null;
  costco_cases_per_layer: number | null;
  costco_layers_per_pallet: number | null;
  costco_units_per_pallet: number | null;
  sams_cases_per_layer: number | null;
  sams_layers_per_pallet: number | null;
  sams_units_per_pallet: number | null;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BusinessCentralItemSyncEvent {
  id: string;
  organization_id: string;
  item_id: string | null;
  run_id: string | null;
  direction: BusinessCentralSyncDirection;
  status: BusinessCentralSyncEventStatus;
  actor_user_id: string | null;
  actor_user_label: string | null;
  bc_item_id: string | null;
  bc_item_number: string | null;
  error_class: BusinessCentralErrorClass | null;
  error_message: string | null;
  changed_fields: string[] | null;
  request_summary: Record<string, unknown> | null;
  response_summary: Record<string, unknown> | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface ItemWithCategory extends Item {
  item_name: ItemName;
  category: Category | null;
  product_line: ProductLine | null;
}

export interface UploadSession {
  id: string;
  packaging_id: string;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  status: UploadStatus;
  archived: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadSessionWithDetails extends UploadSession {
  files: FileRecord[];
  uploader?: User;
}

export interface FileRecord {
  id: string;
  upload_session_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string;
  storage_path: string;
  created_at: string;
}

export interface OrgOrderSettings {
  organization_id: string;
  order_prefix: string;
  order_padding: number;
  current_sequence: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  organization_id: string;
  order_number: string;
  order_sequence: number;
  order_date: string;
  created_by: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_name_id: string | null;
  category_id: string | null;
  version: string | null;
  approval_status: ItemStatus | null;
  notes: string | null;
  order_qty: number | null;
  item_order_status: ItemOrderStatus;
  priority: ItemPriority;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemWithDetails extends OrderItem {
  item_name: ItemName | null;
  category: Category | null;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  order_items: OrderItemWithDetails[];
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<
          User,
          | "created_at"
          | "updated_at"
          | "permissions_updated_at"
          | "permissions_version"
        > & {
          created_at?: string;
          updated_at?: string;
          permissions_updated_at?: string | null;
          permissions_version?: number;
        };
        Update: Partial<Omit<User, "id">>;
      };
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Organization, "id">>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Category, "id">>;
      };
      product_lines: {
        Row: ProductLine;
        Insert: Omit<ProductLine, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProductLine, "id">>;
      };
      item_names: {
        Row: ItemName;
        Insert: Omit<ItemName, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ItemName, "id">>;
      };
      items: {
        Row: Item;
        Insert: Omit<
          Item,
          | "id"
          | "created_at"
          | "updated_at"
          | "archived"
          | "product_line_id"
          | "version"
          | "status"
          | "bc_item_id"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
          product_line_id?: string | null;
          version?: string | null;
          status?: ItemStatus;
          bc_item_id?: string | null;
        };
        Update: Partial<Omit<Item, "id">>;
      };
      upload_sessions: {
        Row: UploadSession;
        Insert: Omit<
          UploadSession,
          "id" | "created_at" | "updated_at" | "uploaded_at" | "status"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          uploaded_at?: string;
          status?: UploadStatus;
        };
        Update: Partial<Omit<UploadSession, "id">>;
      };
      files: {
        Row: FileRecord;
        Insert: Omit<FileRecord, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<FileRecord, "id">>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Omit<
          PurchaseOrder,
          | "id"
          | "created_at"
          | "updated_at"
          | "order_number"
          | "order_sequence"
          | "archived"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
        };
        Update: Partial<Omit<PurchaseOrder, "id">>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<
          OrderItem,
          | "id"
          | "created_at"
          | "updated_at"
          | "item_order_status"
          | "priority"
          | "sort_order"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          item_order_status?: ItemOrderStatus;
          priority?: ItemPriority;
          sort_order?: number;
        };
        Update: Partial<Omit<OrderItem, "id">>;
      };

      business_central_connections: {
        Row: BusinessCentralConnection;
        Insert: Omit<
          BusinessCentralConnection,
          "id" | "created_at" | "updated_at" | "api_base_url" | "sync_enabled"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          api_base_url?: string;
          sync_enabled?: boolean;
        };
        Update: Partial<Omit<BusinessCentralConnection, "id">>;
      };
      business_central_item_categories: {
        Row: BusinessCentralItemCategory;
        Insert: Omit<
          BusinessCentralItemCategory,
          "id" | "created_at" | "updated_at" | "last_refreshed_at" | "is_active"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_refreshed_at?: string;
        };
        Update: Partial<Omit<BusinessCentralItemCategory, "id">>;
      };
      business_central_tax_groups: {
        Row: BusinessCentralTaxGroup;
        Insert: Omit<
          BusinessCentralTaxGroup,
          "id" | "created_at" | "updated_at" | "last_refreshed_at" | "is_active"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_refreshed_at?: string;
        };
        Update: Partial<Omit<BusinessCentralTaxGroup, "id">>;
      };
      business_central_units_of_measure: {
        Row: BusinessCentralUnitOfMeasure;
        Insert: Omit<
          BusinessCentralUnitOfMeasure,
          "id" | "created_at" | "updated_at" | "last_refreshed_at" | "is_active"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_refreshed_at?: string;
        };
        Update: Partial<Omit<BusinessCentralUnitOfMeasure, "id">>;
      };
      business_central_general_product_posting_groups: {
        Row: BusinessCentralGeneralProductPostingGroup;
        Insert: Omit<
          BusinessCentralGeneralProductPostingGroup,
          "id" | "created_at" | "updated_at" | "last_refreshed_at" | "is_active"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_refreshed_at?: string;
        };
        Update: Partial<Omit<BusinessCentralGeneralProductPostingGroup, "id">>;
      };
      business_central_inventory_posting_groups: {
        Row: BusinessCentralInventoryPostingGroup;
        Insert: Omit<
          BusinessCentralInventoryPostingGroup,
          "id" | "created_at" | "updated_at" | "last_refreshed_at" | "is_active"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_refreshed_at?: string;
        };
        Update: Partial<Omit<BusinessCentralInventoryPostingGroup, "id">>;
      };
      business_central_items: {
        Row: BusinessCentralItem;
        Insert: Omit<
          BusinessCentralItem,
          | "id"
          | "created_at"
          | "updated_at"
          | "blocked"
          | "price_includes_tax"
          | "bc_raw_payload"
          | "sync_status"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          blocked?: boolean;
          price_includes_tax?: boolean;
          bc_raw_payload?: Record<string, unknown>;
          sync_status?: BusinessCentralSyncStatus;
        };
        Update: Partial<Omit<BusinessCentralItem, "id">>;
      };
      business_central_item_details: {
        Row: BusinessCentralItemDetails;
        Insert: Omit<
          BusinessCentralItemDetails,
          "created_at" | "updated_at" | "custom_fields"
        > & {
          created_at?: string;
          updated_at?: string;
          custom_fields?: Record<string, unknown>;
        };
        Update: Partial<Omit<BusinessCentralItemDetails, "item_id">>;
      };
      business_central_item_sync_events: {
        Row: BusinessCentralItemSyncEvent;
        Insert: Omit<BusinessCentralItemSyncEvent, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<BusinessCentralItemSyncEvent, "id">>;
      };
      org_order_settings: {
        Row: OrgOrderSettings;
        Insert: Omit<
          OrgOrderSettings,
          "created_at" | "updated_at" | "current_sequence"
        > & {
          created_at?: string;
          updated_at?: string;
          current_sequence?: number;
        };
        Update: Partial<Omit<OrgOrderSettings, "organization_id">>;
      };
    };
  };
}
