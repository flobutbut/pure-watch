# Encre sur cadrans clairs

Cette comparaison archive la première correction des traits perforés. Le lissage final des bords et le test de conservation du cœur opaque sont décrits dans `documentation/print-softness/README.md`.

Le lissage alpha-to-coverage du matériau d'impression perforait les traits fins, particulièrement visibles en encre foncée sur fond crème ou blanc. Il est désactivé pour l'impression du cadran, comme pour les graduations du réhaut. La découpe alpha conserve une impression opaque, présente dans la passe de transmission du verre.

Le test de rendu `e2e/dial-print-coverage.spec.ts` isole les chiffres et la piste pour mesurer leur opacité indépendamment de l'éclairage, des aiguilles et du boîtier. Avant correction, seuls 35 % des pixels d'encre du cas crème/sans étaient pleinement opaques. Cette première correction exigeait plus de 95 % sur les cadrans crème, blancs et noirs, avec plusieurs polices et pistes. Il passe sur ordinateur et mobile et échoue avec le matériau précédent.

`comparison.png` montre les vues avant/après sous le même éclairage. Les captures couvrent aussi les chiffres romains, la police Art déco, les cadrans façonnés, un cadran noir de contrôle et le rendu sous un cristal avec transmission. La comparaison force explicitement l'ancien traitement pour reproduire le défaut avec le moteur actuel.

Pour régénérer les images, démarrer Vite sur `127.0.0.1:5173`, puis lancer `node scripts/light-dial-print-review.mjs`, avec au besoin `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
