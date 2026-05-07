export type ReportImportRegistration = {
  id: string;
  sourceName: string;
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'pdf';
  mappedPack: string;
  owner: string;
  validationStatus: 'registered' | 'validated' | 'rejected';
};

export function validateReportRegistration(registration: ReportImportRegistration) {
  const errors: string[] = [];
  if (!registration.sourceName.trim()) errors.push('Source report name is required.');
  if (!registration.fileName.trim()) errors.push('File name is required.');
  if (!registration.mappedPack.trim()) errors.push('Mapped report pack is required.');
  return { valid: errors.length === 0, errors };
}
