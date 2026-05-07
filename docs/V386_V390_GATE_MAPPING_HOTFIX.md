# v386-v390 Gate Mapping Hotfix

This hotfix maps `inventoryGate` and `productionGate` in the AppShell page map. They already existed in the sidebar and metadata, but the page map omitted them, so clicking those routes rendered an empty module area.

It also strengthens `qa:v386-v390` so navigation keys must be mapped to their actual React components, not merely present as strings.
