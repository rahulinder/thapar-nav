export function decodeFile(buffer) {
    try {
        return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), converted: false };
    } catch (error) {
        return { text: new TextDecoder("windows-1252").decode(buffer), converted: true };
    }
}

function detectDelimiter(text) {
    const firstLine = text.split(/\r\n|\n|\r/)[0] || "";
    const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1]);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function parseCsv(input) {
    let text = input;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"' && field === "") {
            quoted = true;
        } else if (c === delimiter) {
            row.push(field);
            field = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i += 1;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += c;
        }
    }
    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

export function toCsv(rows) {
    return rows
        .map((row) => row.map((value) => (/[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value)).join(","))
        .join("\r\n");
}
