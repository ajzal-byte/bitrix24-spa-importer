export type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
  total?: number;
};

export type CrmType = {
  id: number;
  title: string;
  entityTypeId: number;
  customSectionId: number | null;
  isCategoriesEnabled: "Y" | "N";
  isStagesEnabled: "Y" | "N";
  isBeginCloseDatesEnabled: "Y" | "N";
  isClientEnabled: "Y" | "N";
  isUseInUserfieldEnabled: "Y" | "N";
  isLinkWithProductsEnabled: "Y" | "N";
  isMycompanyEnabled: "Y" | "N";
  isDocumentsEnabled: "Y" | "N";
  isSourceEnabled: "Y" | "N";
  isObserversEnabled: "Y" | "N";
  isRecyclebinEnabled: "Y" | "N";
  isAutomationEnabled: "Y" | "N";
  isBizProcEnabled: "Y" | "N";
  isSetOpenPermissions: "Y" | "N";
  isPaymentsEnabled?: "Y" | "N";
  isCountersEnabled?: "Y" | "N";
  linkedUserFields?: Record<string, string>;
  relations?: {
    parent?: Array<{
      entityTypeId: number;
      isChildrenListEnabled: "Y" | "N";
      isPredefined?: "Y" | "N";
    }>;
    child?: Array<{
      entityTypeId: number;
      isChildrenListEnabled: "Y" | "N";
      isPredefined?: "Y" | "N";
    }>;
  };
};

export type CrmFieldDescription = {
  type: string;
  isRequired?: boolean;
  isMultiple?: boolean;
  title?: string;
  upperName?: string;
  formLabel?: string;
  listLabel?: string;
  filterLabel?: string;
  items?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
};

export type NormalizedField = {
  title: string;
  fieldName: string;
  userTypeId: string;
  isMultiple: boolean;
  isRequired: boolean;
  editFormLabel: Record<string, string>;
  listColumnLabel: Record<string, string>;
  listFilterLabel: Record<string, string>;
  items: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
};

export type AutomatedSolution = {
  id: number;
  title: string;
  typeIds?: number[];
};

const WEBHOOK_PATTERN =
  /^https?:\/\/[a-z0-9.-]+(?::\d+)?\/rest\/\d+\/[a-z0-9]+\/?$/i;

const STOCK_ENTITY_TYPE_IDS = new Set([1, 2, 3, 4, 31]);

function isYes(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "y" || normalized === "true" || normalized === "1";
  }
  return false;
}

export function normalizeWebhookUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function isValidWebhookUrl(url: string): boolean {
  if (!url.trim()) return false;
  return WEBHOOK_PATTERN.test(normalizeWebhookUrl(url));
}

export class BitrixApiError extends Error {
  code: string;

  constructor(code: string, description?: string) {
    super(description ?? code);
    this.code = code;
    this.name = "BitrixApiError";
  }
}

function flattenPayload(
  base: unknown,
  target: Record<string, string>,
  prefix = "",
) {
  if (Array.isArray(base)) {
    base.forEach((value, index) => {
      flattenPayload(value, target, `${prefix}[${index}]`);
    });
    return;
  }

  if (base !== null && typeof base === "object") {
    for (const [key, value] of Object.entries(
      base as Record<string, unknown>,
    )) {
      flattenPayload(value, target, prefix ? `${prefix}[${key}]` : key);
    }
    return;
  }

  if (base !== undefined && base !== null && prefix) {
    target[prefix] = String(base);
  }
}

export async function callBitrix<T>(
  webhookUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  encoding: "json" | "form" = "json",
): Promise<T> {
  const normalizedWebhookUrl = normalizeWebhookUrl(webhookUrl);
  const useForm = encoding === "form";
  let requestBody: string;
  let contentType: string;

  if (useForm) {
    const flattened: Record<string, string> = {};
    flattenPayload(params, flattened);
    requestBody = new URLSearchParams(flattened).toString();
    contentType = "application/x-www-form-urlencoded";
  } else {
    requestBody = JSON.stringify(params);
    contentType = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${normalizedWebhookUrl}${method}`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Accept: "application/json",
      },
      body: requestBody,
    });
  } catch {
    throw new BitrixApiError(
      "NETWORK_ERROR",
      "Could not connect to the Bitrix24 webhook. Check the portal URL and CORS settings.",
    );
  }

  let payload: BitrixResponse<T>;
  try {
    payload = (await response.json()) as BitrixResponse<T>;
  } catch {
    throw new BitrixApiError(
      "INVALID_RESPONSE",
      "Failed to parse Bitrix API response",
    );
  }

  if (!response.ok || payload.error) {
    throw new BitrixApiError(
      payload.error ?? "REQUEST_FAILED",
      payload.error_description ??
        `Request failed with status ${response.status}`,
    );
  }

  if (payload.result === undefined) {
    throw new BitrixApiError(
      "EMPTY_RESULT",
      "Bitrix API returned an empty result",
    );
  }

  return payload.result;
}

export async function listSpaTypes(webhookUrl: string): Promise<CrmType[]> {
  const result = await callBitrix<{ types?: CrmType[] } | CrmType[]>(
    webhookUrl,
    "crm.type.list",
    {},
  );

  if (Array.isArray(result)) {
    return result;
  }

  return result.types ?? [];
}

export async function getSpaType(
  webhookUrl: string,
  id: number,
): Promise<CrmType> {
  const result = await callBitrix<{ type: CrmType }>(
    webhookUrl,
    "crm.type.get",
    { id },
  );
  return result.type;
}

export async function listAutomatedSolutions(
  webhookUrl: string,
): Promise<AutomatedSolution[]> {
  const result = await callBitrix<{ automatedSolutions?: AutomatedSolution[] }>(
    webhookUrl,
    "crm.automatedsolution.list",
    {},
  );

  return result.automatedSolutions ?? [];
}

export async function getAutomatedSolution(
  webhookUrl: string,
  id: number,
): Promise<AutomatedSolution> {
  const result = await callBitrix<{ automatedSolution: AutomatedSolution }>(
    webhookUrl,
    "crm.automatedsolution.get",
    { id },
  );

  return result.automatedSolution;
}

export async function createAutomatedSolution(
  webhookUrl: string,
  title: string,
): Promise<AutomatedSolution> {
  const result = await callBitrix<{ automatedSolution: AutomatedSolution }>(
    webhookUrl,
    "crm.automatedsolution.add",
    {
      fields: { title },
    },
  );

  return result.automatedSolution;
}

export async function ensureWorkplace(
  sourceWebhook: string,
  targetWebhook: string,
  sourceCustomSectionId: number | null,
): Promise<number | null> {
  if (sourceCustomSectionId == null) {
    return null;
  }

  let workplaceTitle = "Imported SPAs";

  try {
    const sourceWorkplace = await getAutomatedSolution(
      sourceWebhook,
      sourceCustomSectionId,
    );
    if (sourceWorkplace.title) {
      workplaceTitle = sourceWorkplace.title;
    }
  } catch {
    // Fall back to default title when source workplace cannot be read.
  }

  const existing = await listAutomatedSolutions(targetWebhook);
  const match = existing.find(
    (workplace) =>
      workplace.title.toLowerCase() === workplaceTitle.toLowerCase(),
  );

  if (match) {
    return match.id;
  }

  const created = await createAutomatedSolution(targetWebhook, workplaceTitle);
  return created.id;
}

function filterRelations(relations?: CrmType["relations"]) {
  if (!relations) return undefined;

  const parent = relations.parent?.filter((relation) =>
    STOCK_ENTITY_TYPE_IDS.has(relation.entityTypeId),
  );
  const child = relations.child?.filter((relation) =>
    STOCK_ENTITY_TYPE_IDS.has(relation.entityTypeId),
  );

  if (!parent?.length && !child?.length) {
    return undefined;
  }

  return {
    parent,
    child,
  };
}

export function buildSpaCreateFields(
  sourceType: CrmType,
  customSectionId: number | null,
) {
  const fields: Record<string, unknown> = {
    title: sourceType.title,
    isCategoriesEnabled: sourceType.isCategoriesEnabled,
    isStagesEnabled: sourceType.isStagesEnabled,
    isBeginCloseDatesEnabled: sourceType.isBeginCloseDatesEnabled,
    isClientEnabled: sourceType.isClientEnabled,
    isUseInUserfieldEnabled: sourceType.isUseInUserfieldEnabled,
    isLinkWithProductsEnabled: sourceType.isLinkWithProductsEnabled,
    isMycompanyEnabled: sourceType.isMycompanyEnabled,
    isDocumentsEnabled: sourceType.isDocumentsEnabled,
    isSourceEnabled: sourceType.isSourceEnabled,
    isObserversEnabled: sourceType.isObserversEnabled,
    isRecyclebinEnabled: sourceType.isRecyclebinEnabled,
    isAutomationEnabled: sourceType.isAutomationEnabled,
    isBizProcEnabled: sourceType.isBizProcEnabled,
    isSetOpenPermissions: sourceType.isSetOpenPermissions,
  };

  if (customSectionId != null) {
    fields.customSectionId = customSectionId;
  }

  if (sourceType.isPaymentsEnabled) {
    fields.isPaymentsEnabled = sourceType.isPaymentsEnabled;
  }

  if (sourceType.isCountersEnabled) {
    fields.isCountersEnabled = sourceType.isCountersEnabled;
  }

  if (sourceType.linkedUserFields) {
    fields.linkedUserFields = sourceType.linkedUserFields;
  }

  const relations = filterRelations(sourceType.relations);
  if (relations) {
    fields.relations = relations;
  }

  return fields;
}

export async function createSpaType(
  webhookUrl: string,
  sourceType: CrmType,
  customSectionId: number | null,
): Promise<CrmType> {
  const result = await callBitrix<{ type: CrmType }>(
    webhookUrl,
    "crm.type.add",
    {
      fields: buildSpaCreateFields(sourceType, customSectionId),
    },
  );

  return result.type;
}

export async function fetchCustomFields(
  webhookUrl: string,
  entityTypeId: number,
): Promise<NormalizedField[]> {
  const result = await callBitrix<{
    fields: Record<string, CrmFieldDescription>;
  }>(webhookUrl, "crm.item.fields", {
    entityTypeId,
  });

  const userFields: NormalizedField[] = [];

  for (const [fieldCode, fieldData] of Object.entries(result.fields ?? {})) {
    if (!fieldCode.toLowerCase().startsWith("uf")) continue;

    const title =
      fieldData.title ?? fieldCode.replace(/^uf/, "").replaceAll("_", " ");
    const upperName = fieldData.upperName ?? fieldCode;

    userFields.push({
      title,
      fieldName: upperName,
      userTypeId: fieldData.type,
      isMultiple: isYes(fieldData.isMultiple),
      isRequired: isYes(fieldData.isRequired),
      editFormLabel: { en: fieldData.formLabel ?? title },
      listColumnLabel: { en: fieldData.listLabel ?? title },
      listFilterLabel: { en: fieldData.filterLabel ?? title },
      items: fieldData.items ?? [],
      settings: fieldData.settings ?? {},
    });
  }

  return userFields;
}

export function rebuildFieldName(
  upperName: string,
  spaNumericId: number,
): string {
  const source = upperName.toUpperCase();
  const parts = source.split("_");

  if (parts.length >= 4 && parts[0] === "UF" && parts[1] === "CRM") {
    parts[2] = String(spaNumericId);
    return parts.join("_").slice(0, 50);
  }

  const suffix = source
    .replace(/^UF_CRM_\d+_?/i, "")
    .replace(/[^A-Z0-9_]/g, "_");
  return `UF_CRM_${spaNumericId}_${suffix}`.slice(0, 50);
}

function buildEnumItems(items: Array<Record<string, unknown>>) {
  return items.map((item, index) => ({
    value: String(item.VALUE ?? item.value ?? ""),
    sort: Number(item.SORT ?? item.sort ?? (index + 1) * 100),
    def: String(item.DEF ?? item.def ?? "N"),
  }));
}

export async function createFieldInTarget(
  webhookUrl: string,
  spaNumericId: number,
  fieldData: NormalizedField,
): Promise<unknown> {
  const fieldName = rebuildFieldName(fieldData.fieldName, spaNumericId);

  const field: Record<string, unknown> = {
    entityId: `CRM_${spaNumericId}`,
    fieldName,
    userTypeId: fieldData.userTypeId,
    multiple: fieldData.isMultiple ? "Y" : "N",
    mandatory: fieldData.isRequired ? "Y" : "N",
    editFormLabel: fieldData.editFormLabel,
    listColumnLabel: fieldData.listColumnLabel,
    listFilterLabel: fieldData.listFilterLabel,
  };

  if (Object.keys(fieldData.settings).length > 0) {
    field.settings = fieldData.settings;
  }

  if (fieldData.userTypeId === "enumeration" && fieldData.items.length > 0) {
    field.enum = buildEnumItems(fieldData.items);
  }

  const result = await callBitrix<{ field?: unknown; id?: number }>(
    webhookUrl,
    "userfieldconfig.add",
    {
      moduleId: "crm",
      field,
    },
    "form",
  );

  return result.field ?? result;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
