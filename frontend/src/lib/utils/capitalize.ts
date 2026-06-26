
export function captalize(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function normalizeName(name: string) {
    return name.trim().split(" ").map(captalize).join(" ");
}

