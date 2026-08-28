import ExcelJS from 'exceljs';

/**
 * Section 4 node 11's "tracker.xlsx" row, generated on demand from the
 * approved applications already in Mongo — not maintained as a live
 * side-file.
 */
export async function buildTrackerXlsxBuffer(applications) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Applications');
  worksheet.columns = [
    { header: 'Company', key: 'companyName', width: 30 },
    { header: 'Approved', key: 'approvedAt', width: 20 },
    { header: 'ATS Score', key: 'atsScore', width: 12 },
    { header: 'Cover Letter', key: 'coverLetterRequested', width: 14 },
    { header: 'Reference URL', key: 'referenceUrl', width: 40 },
  ];

  worksheet.addRows(
    applications.map((application) => ({
      companyName: application.companyName,
      approvedAt: application.approvedAt ? new Date(application.approvedAt) : null,
      atsScore: application.atsScore ?? '',
      coverLetterRequested: application.coverLetterRequested ? 'Yes' : 'No',
      referenceUrl: application.referenceUrl || '',
    }))
  );

  return workbook.xlsx.writeBuffer();
}
