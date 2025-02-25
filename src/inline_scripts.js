window.onload = async () => {
	let inlineScripts = await Storage.get("inlineScripts");
	if (!inlineScripts) {
		return;
	}
	let scripts = inlineScripts[window.location.href];
	if (!scripts) {
		return;
	}
	for (const script of scripts) {
		eval(script);
	}
};
