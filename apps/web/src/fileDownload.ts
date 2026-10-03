export function downloadFile(
  filename: string,
  contentType: string,
  content: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type: contentType }));
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
