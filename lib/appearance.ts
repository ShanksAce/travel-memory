export const themes = [
    { id: 'fieldnotes', name: '旅行手記', colors: ['#faf2ec', '#31563e', '#efe4d7'] },
    { id: 'gallery', name: '展廳白', colors: ['#ffffff', '#f5f5f7', '#0071e3'] },
    { id: 'journal', name: '暖紙手帳', colors: ['#f6f3ed', '#883f2b', '#eee7dc'] },
    { id: 'forest', name: '山林青綠', colors: ['#f7f9f5', '#325d48', '#eaf0e7'] },
    { id: 'ocean', name: '海灣晴藍', colors: ['#f6f9fb', '#245a7a', '#e8f0f6'] },
    { id: 'night', name: '暮夜深色', colors: ['#171b26', '#c1b8ef', '#262d3d'] },
] as const;

export function selectedTheme(saved?: string) {
    return themes.find(theme => theme.id === saved)?.id ?? themes[0].id;
}
