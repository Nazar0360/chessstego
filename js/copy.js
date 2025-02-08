function copyToClipboard(elementId, btn) {
	const element = document.getElementById(elementId);
	if (!element) return;
	const text = element.value || element.innerText;
	if (!text) return;
	navigator.clipboard.writeText(text)
		.then(() => {
			const originalText = btn.innerText;
			btn.innerText = "Copied";
			setTimeout(() => {
				btn.innerText = originalText;
			}, 1500);
		})
		.catch(err => {
			console.error('Failed to copy text: ', err);
		});
}
