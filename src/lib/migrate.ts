import {
  createFieldInTarget,
  createSpaType,
  ensureWorkplace,
  fetchCustomFields,
  getSpaType,
  sleep,
  type CrmType,
} from './bitrix'

export type MigrationFieldResult = {
  title: string
  fieldName: string
  success: boolean
  error?: string
}

export type MigrationResult = {
  sourceType: CrmType
  createdType: CrmType
  workplaceId: number | null
  fieldsTotal: number
  fieldsSucceeded: number
  fieldsFailed: number
  fieldResults: MigrationFieldResult[]
}

export type ProgressCallback = (message: string) => void

export async function migrateSpa(
  sourceWebhook: string,
  targetWebhook: string,
  sourceSpaId: number,
  onProgress: ProgressCallback,
): Promise<MigrationResult> {
  onProgress('Reading source SPA settings..')

  const sourceType = await getSpaType(sourceWebhook, sourceSpaId)

  let workplaceId: number | null = null
  if (sourceType.customSectionId != null) {
    onProgress('Creating workplace..')
    workplaceId = await ensureWorkplace(
      sourceWebhook,
      targetWebhook,
      sourceType.customSectionId,
    )
  }

  onProgress('Creating SPA..')
  const createdType = await createSpaType(targetWebhook, sourceType, workplaceId)

  onProgress('Fetching custom fields..')
  const fields = await fetchCustomFields(sourceWebhook, sourceType.entityTypeId)

  const fieldResults: MigrationFieldResult[] = []
  let fieldsSucceeded = 0
  let fieldsFailed = 0

  if (fields.length === 0) {
    return {
      sourceType,
      createdType,
      workplaceId,
      fieldsTotal: 0,
      fieldsSucceeded: 0,
      fieldsFailed: 0,
      fieldResults,
    }
  }

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]
    onProgress(`Creating Fields ${index + 1}/${fields.length}`)

    try {
      await createFieldInTarget(targetWebhook, createdType.id, field)
      fieldsSucceeded += 1
      fieldResults.push({
        title: field.title,
        fieldName: field.fieldName,
        success: true,
      })
    } catch (error) {
      fieldsFailed += 1
      fieldResults.push({
        title: field.title,
        fieldName: field.fieldName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    if (index < fields.length - 1) {
      await sleep(450)
    }
  }

  return {
    sourceType,
    createdType,
    workplaceId,
    fieldsTotal: fields.length,
    fieldsSucceeded,
    fieldsFailed,
    fieldResults,
  }
}
