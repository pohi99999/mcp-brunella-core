import { ExtensionManager } from '../extensions';

const extensions = new ExtensionManager();

export async function extensionCommand(action: string) {
    // Felfedezzük a bővítményeket a művelet előtt
    await extensions.discoverExtensions();

    switch (action) {
        case 'list':
            console.log('📦 Telepített bővítmények:');
            const extList = extensions.getExtensions();
            if (extList.length === 0) {
                console.log('Nincs telepített bővítmény.');
            } else {
                extList.forEach(ext => console.log(`- ${ext.name} (v${ext.version}): ${ext.description}`));
            }
            break;
        case 'install':
            console.log('Telepítés funkció még nincs implementálva.');
            break;
        default:
            console.log(`Ismeretlen művelet: ${action}`);
            console.log('Használat: brunella extension <list|install>');
    }
}