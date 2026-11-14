# **Cahier des charges fonctionnel, CLPS Lunar Mission Browser** 

## **Cahier des charges fonctionnel** 

### **CLPS Lunar Mission Browser** 

NASA Space Apps Challenge 2026. Version 1.1 

### **1. Pourquoi ce projet** 

Quand on prépare une mission vers le pôle sud de la Lune, une question revient tout le temps : à quel endroit et à quelle date aura-t-on assez de lumière pour alimenter l’atterrisseur, et pourrat-on parler directement à la Terre ? Là-bas, le Soleil rase l’horizon et la Terre n’en est jamais très loin, si bien que le moindre relief change tout. 

Les outils qui donnent la position du Soleil et de la Terre existent déjà, mais leurs interfaces sont chargées et il est long de comparer plusieurs sites ou plusieurs dates. Or la planification d’une mission demande de la coordination entre les équipes scientifiques et les équipes d’ingénierie, et elle doit pouvoir être revue vite quand le calendrier ou le matériel changent. 

Notre projet vise à rendre cette comparaison simple, rapide et lisible, y compris pour quelqu’un qui n’est pas spécialiste. Il doit servir trois usages : 

- aider les planificateurs à coordonner science et ingénierie pendant le développement d’une mission ; 

- permettre de réagir vite quand un retard de calendrier ou une difficulté de matériel oblige à changer la date ou le lieu d’atterrissage ; 

- servir d’outil pédagogique pour que les élèves, les étudiants et le public comprennent les défis de l’exploration lunaire et pourquoi leur planification est si complexe. 

### **2. Ce que fera l’outil** 

L’utilisateur choisit une mission CLPS, un site d’atterrissage, une date et une durée de séjour. L’outil lui montre où se trouvent le Soleil et la Terre dans le ciel, en tenant compte du relief autour du site. Il en tire quelques chiffres simples : la part du temps où le site est éclairé, la plus longue nuit à passer, et les périodes pendant lesquelles la Terre est visible. 

Ensuite, l’outil aide à décider. Il permet de décaler la date d’atterrissage en un clic, de repérer les meilleures dates pour un site, de comparer un plan de référence à un plan alternatif, et de vérifier si un site respecte des seuils fixés par les équipes (par exemple une nuit de moins de trois jours). Chaque vue peut être partagée par un lien, afin que scientifiques et ingénieurs regardent exactement la même chose. 

Enfin, un mode « Découvrir » explique en langage simple pourquoi le pôle sud est à la fois intéressant et difficile, avec des scénarios guidés destinés aux élèves et au grand public. 

Ce que l’outil ne fera pas : simuler la descente de l’atterrisseur ou calculer une trajectoire, faire des calculs thermiques détaillés, gérer des comptes d’utilisateurs, ni permettre l’édition à plusieurs en temps réel. 

### **3. À qui il s’adresse** 

|Profil|Besoinprincipal|
|---|---|
|Planificateur de mission|Comparer vite des sites et des dates, et réagir<br>à un changement de calendrier|
|Équipe scientifique|Connaître les conditions d’éclairage (hauteur<br>et direction du Soleil, ombres) aux heures<br>utiles aux instruments|
|Équipe d’ingénierie|Connaître l’énergie disponible, la durée des<br>nuits et les fenêtres de communication|
|Enseignant, étudiant|Comprendre l’éclairage du pôle sud lunaire et<br>ce qui rend la planification complexe|
|Grand public|Explorer visuellement les sites des missions,<br>sans vocabulaire technique|



### **4. Situations d’usage** 

**Coordonner science et ingénierie.** Une équipe scientifique veut observer une zone avec un Soleil bas, qui fait ressortir le relief. L’équipe d’ingénierie, elle, veut un maximum d’énergie et peu de nuit. Les deux ouvrent le même lien : la vue du site, la frise du temps et les chiffres sont identiques. Chacun bascule sur son profil de lecture (science ou ingénierie) et note ses contraintes. Les désaccords se discutent sur des chiffres communs plutôt que sur des impressions. 

**Réagir à un retard.** Le matériel prend du retard : l’atterrissage prévu le 12 doit passer au 22. Le planificateur décale la date de dix jours. L’outil montre qu’une nuit de quatre jours tombe maintenant en plein milieu du séjour. Il consulte le calendrier des meilleures dates, puis compare deux solutions : garder le site avec une autre date, ou changer de site et garder la date. Le verdict par rapport aux seuils fixés l’aide à trancher, et il exporte un récapitulatif d’une page pour l’équipe. 

**Enseigner.** Un enseignant lance le scénario « Pourquoi une nuit lunaire dure deux semaines ailleurs, mais pas au pôle sud ». Les élèves déplacent le curseur de date, voient le Soleil raser l’horizon, puis comparent un site polaire à un site de référence proche de l’équateur. Ils répondent à quelques questions de réflexion. 

### **5. Fonctions attendues** 

Nous classons chaque fonction en trois niveaux : indispensable (I), souhaitable (S) et bonus (B). Si le temps manque, nous livrons d’abord tout ce qui est indispensable. 

#### **5.1 Choisir un site et une date** 

|Réf.|Fonction|Niveau|
|---|---|---|
|F-01|Choisir une mission CLPS<br>dans une liste|I|
|F-02|Choisir un site, avec ses<br>coordonnées affichées|I|
|F-03|Choisir la date et l’heure avec<br>un calendrier et un curseur|I|
|F-04|Ajouter un site de son choix<br>en saisissant latitude et<br>longitude|B|
|**5.2 Voir le ciel depuis le site**|||
|Réf.|Fonction|Niveau|
|F-10|Vue circulaire de l’horizon<br>avec la position du Soleil et<br>de la Terre|I|
|F-11|Affichage du relief sur cette<br>vue|S|
|F-12|Frise du temps : Soleil visible<br>en jaune, Terre visible en<br>bleu, ombre en gris|I|
|F-13|Zoom de la frise sur un jour,<br>un mois ou l’année, avec le<br>détail de la zone affichée|S|
|F-14|Valeurs précises au survol ou<br>au toucher|S|
|F-15|Vue 3D du site|B|
|**5.3 Les chiffres à retenir**|||
|Réf.|Fonction|Niveau|
|F-20|Part du temps ensoleillé, par<br>jour, par mois et sur toute la<br>période|I|
|F-21|Plus longue nuit continue,<br>avec sa date de début et sa<br>durée|I|
|F-22|Liste des périodes de<br>visibilité de la Terre|I|
|F-23|Note globale mêlant énergie<br>et communication, dont le<br>poids est réglable|S|



#### **5.4 Comparer** 

|Réf.|Fonction|Niveau|
|---|---|---|
|F-30|Comparer deux ou trois sites<br>côte à côte sur la même<br>période|I|
|F-31|Comparer deux dates pour un<br>même site|I|
|F-32|Tableau récapitulatif qui<br>classe les sites|I|
|F-33|Export des résultats en CSV<br>ou en image|B|
|**5.5 Aide**<br>Réf.|Fonction<br>Niveau||
|F-40|Page d’aide qui explique<br>les chiffres et leurs<br>limites<br>S||
|F-41|Visite guidée au premier<br>lancement<br>B||



#### **5.6 Réagir à un changement de calendrier ou de matériel** 

Quand un retard ou un problème de matériel oblige à revoir la date ou le lieu, l’équipe doit obtenir une réponse en quelques secondes. 

|Réf.|Fonction|Niveau|
|---|---|---|
|F-50|Régler la durée du séjour<br>(par exemple 7 jours, 14 jours<br>ou un jour lunaire complet) :<br>les chiffres portent alors sur<br>la durée réelle de la mission|I|
|F-51|Décaler la date d’atterrissage<br>en un clic (moins 7 jours,<br>moins 1 jour, plus 1 jour, plus<br>7 jours) avec recalcul<br>immédiat|I|
|F-52|Calendrier des meilleures<br>dates pour un site et une<br>durée de séjour : carte de<br>chaleur et liste des cinq<br>meilleures dates de départ|S|
|F-53|Comparer un plan de<br>référence à un plan alternatif<br>(site, date) avec l’écart|I|



|Réf.|Fonction|Niveau|
|---|---|---|
||affiché sur chaque chiffre||
|F-54|Fixer des seuils de contrainte<br>(ensoleillement minimal,<br>nuit maximale, fenêtre de<br>Terre minimale) et afficher<br>pour chaque site « respecté »<br>ou « non respecté », en texte<br>et pas seulement en couleur|S|
|F-55|Pour une date donnée,<br>classer tous les sites connus,<br>afin de choisir un autre lieu<br>si besoin|S|
|**5.7 Coordonner science et in**|**génierie**||
|Réf.|Fonction|Niveau|
|F-60|Deux profils de lecture : «<br>Ingénierie » (énergie, nuit,<br>communication, seuils) et «<br>Science » (hauteur et<br>direction du Soleil à l’heure<br>choisie, durée de l’éclairage<br>rasant, sens des ombres)|S|
|F-61|Lien partageable qui restitue<br>exactement la même vue<br>(site, date, durée, options,<br>profil), sans compte|S|
|F-62|Mention des hypothèses sur<br>chaque vue : version des<br>données, date du calcul,<br>options choisies, limites|I|
|F-63|Récapitulatif d’une page<br>imprimable avec les chiffres,<br>les hypothèses et les sources|S|
|F-64|Zone de notes libre, incluse<br>dans le récapitulatif|B|
|**5.8 Expliquer et enseigner**|||
|Réf.|Fonction|Niveau|
|F-70|Mode « Découvrir » : textes<br>en langage simple et schémas<br>qui expliquent pourquoi la<br>planification est complexe<br>(Soleil rasant, ombres|S|



|Réf.|Fonction|Niveau|
|---|---|---|
||longues, cycle de 29,5 jours,<br>libration de la Terre, relief)||
|F-71|Trois scénarios guidés : le<br>cycle jour-nuit lunaire,<br>pourquoi le pôle sud est<br>stratégique, et ce qui change<br>si l’atterrissage est retardé de<br>quelques jours|S|
|F-72|Infobulles de vocabulaire sur<br>les termes techniques|S|
|F-73|Site de référence proche de<br>l’équateur, pour montrer le<br>contraste avec le pôle sud|B|
|F-74|Questions de réflexion à la fin<br>de chaque scénario|B|
|**5.9 Ressources et données**<br>Réf.|Fonction|Niveau|
|F-80|Les missions, les sites et les<br>sources sont lus depuis des<br>fichiers de configuration<br>(sites.json,sources.json) :<br>ajouter une ressource ne<br>demande pas de modifier le<br>code|I|
|F-81|Une page « Sources » liste<br>chaque ressource utilisée, sa<br>version, son lien et sa licence|I|



### **6. Les données dont nous avons besoin** 

Tout vient de sources publiques de la NASA. Les positions du Soleil et de la Terre sont calculées à partir des fichiers d’éphémérides du service NAIF (SPICE) : de440s.bsp pour les positions, moon_pa_de440_*.bpc, moon_de440_*.tf et pck00011.tpc pour l’orientation de la Lune, et naif0012.tls pour la conversion des dates. Le relief provient du modèle d’altitude polaire de l’instrument LOLA, disponible sur le PDS (LDEM 80S). Les missions et les coordonnées des sites seront relevées à la main sur les pages NASA du programme CLPS, puis rangées dans un fichier sites.json. Chaque site garde le lien de sa source, pour que chacun puisse vérifier. 

La présentation du défi renvoie à un onglet « Ressources » et précise que d’autres ressources peuvent y être ajoutées avant le début de l’événement. Nous prévoyons donc : 

- de relire cet onglet à trois moments : à la constitution de l’équipe, la veille de l’événement et le matin du premier jour ; 

- de noter chaque ressource trouvée dans sources.json, avec sa date de consultation ; 

- • de concevoir l’application pour que l’ajout d’une mission, d’un site ou d’un jeu de données se fasse en modifiant un fichier de configuration, pas le code. 

Exemple d’une entrée de sites.json : 

{ "id": "site_a", "mission": "Nom de la mission", "nom": "Nom du site", "lat": -00.00, "lon": 000.00, "source": "adresse de la page NASA" } 

Exemple d’une entrée de sources.json : 

{ "id": "lola_ldem80s", "titre": "LOLA, modèle d'altitude polaire", "url": "adresse de la ressource", 

"version": "à compléter", "licence": "données publiques NASA", "consulte_le": "AAAAMM-JJ" } 

### **7. Comment les chiffres sont calculés** 

Nous calculons les positions toutes les heures (option : toutes les 30 minutes), sur un à deux ans, pour chaque site. Pour chaque pas de temps, on obtient l’azimut et l’élévation du Soleil et de la Terre vus depuis le site, dans le repère lunaire MOON_ME, avec la correction de lumière LT+S. 

Un astre est considéré comme visible quand son élévation dépasse celle du relief dans la même direction. Sans données de relief, on prend un horizon plat. Pour être plus précis, on pourra tenir compte de la taille apparente du Soleil (environ 0,27°) : il est alors visible dès que son bord supérieur dépasse l’horizon. 

La part ensoleillée est le nombre d’heures où le Soleil est visible divisé par le nombre d’heures de la période. La plus longue nuit est la plus longue série d’heures consécutives sans Soleil. Une fenêtre de visibilité de la Terre est une série d’heures consécutives où elle est visible. La note globale vaut 60 % pour l’énergie et 40 % pour la communication par défaut, chacune ramenée sur 100, et l’utilisateur peut modifier ce partage. 

Quelques précisions sur ces calculs : 

- Quand une durée de séjour est choisie, les indicateurs sont calculés sur cette durée à partir de la date d’atterrissage, et non sur toute la période. 

- Le calendrier des meilleures dates fait glisser une fenêtre de la durée du séjour sur la période calculée, et note chaque date de départ avec la note globale. Aucun nouveau calcul de positions n’est nécessaire : tout vient des données déjà calculées. 

- Un seuil est « respecté » si le chiffre correspondant le satisfait sur toute la durée du séjour (par exemple, plus longue nuit inférieure au seuil). 

- Pour la lecture « Science », on affiche l’élévation et l’azimut du Soleil à l’heure choisie, la durée cumulée où le Soleil est sous 5° d’élévation, et la direction des ombres (opposée à celle du Soleil). 

### **8. Les écrans** 

**L’accueil** propose la liste des missions et des sites, le choix de la date, de la durée de séjour et du profil de lecture, avec un bouton pour explorer. Un accès au mode « Découvrir » y figure aussi. 

**La page d’un site** place la vue circulaire de l’horizon en haut, la frise du temps juste dessous, puis des cartes qui résument la part ensoleillée, la plus longue nuit et les périodes de contact avec la Terre. Des boutons permettent de décaler la date. Un encadré rappelle les hypothèses (version des données, options, limites). Un bouton « Copier le lien » partage la vue. 

**La page de comparaison** présente une colonne par site ou par plan, avec les mêmes chiffres alignés, l’écart par rapport au plan de référence, le verdict par rapport aux seuils et un tableau de classement. 

**La page « Meilleures dates »** affiche le calendrier en carte de chaleur pour un site et une durée, ainsi que la liste des meilleures dates de départ. 

**La page « Découvrir »** propose les scénarios guidés, les explications en langage simple et les questions de réflexion. 

**La page d’aide et de sources** explique la méthode, liste les ressources utilisées et rappelle les limites. 

L’application doit s’utiliser aussi bien sur téléphone que sur ordinateur. Les couleurs doivent rester lisibles pour tous, et l’information ne doit jamais passer uniquement par la couleur : nous ajouterons des motifs ou des libellés. L’interface sera en français, avec une version anglaise. 

### **9. Qualités attendues** 

|Réf.|Exigence|
|---|---|
|NF-01|L’affichage d’un site, un décalage de date ou<br>un changement de plan prennent moins de<br>deux secondes (données précalculées)|
|NF-02|Application entièrement statique,<br>hébergeable gratuitement, sans serveur|
|NF-03|Fonctionne sur les navigateurs récents,<br>ordinateur comme mobile|
|NF-04|Données de chaque site sous 5 Mo|
|NF-05|Navigation au clavier, textes alternatifs,<br>contraste conforme|
|NF-06|README qui explique comment régénérer<br>toutes les données|
|NF-07|Sources et licences citées dans l’application|
|NF-08|Le lien partagé ne contient aucune donnée<br>personnelle et fonctionne sans compte|
|NF-09|Ajouter une mission, un site ou une ressource|



|Réf.|Exigence|
|---|---|
||se fait en modifiant un fichier de<br>configuration|
|NF-10|Les textes du mode « Découvrir » sont<br>compréhensibles par un collégien (vérifié<br>avec au moins trois personnes)|
|**10. Comment nous vérifierons que ça m**|**i   arche**|
|Vérification|Résultat attendu|
|Comparer trois dates sur deux sites avec<br>NASA Moon Trek et LRO Quickmap|Écart d’élévation inférieur à 0,5°|
|Contrôler que les ordres de grandeur sont<br>plausibles|Au pôle sud sans relief, le Soleil reste à<br>environ 1,6° de l’horizon au plus, et la Terre<br>reste près de l’horizon|
|Recalculer à la main la part ensoleillée d’une<br>journée|Même résultat que l’application|
|Afficher trois sites en comparaison|Aucun défaut d’affichage, chiffres alignés|
|Changer de site, décaler la date, changer de<br>plan|Moins de deux secondes|
|Durée de séjour de 14 jours|Les chiffres changent bien par rapport à la<br>période complète et correspondent à un<br>calcul manuel|
|Calendrier des meilleures dates|La meilleure date proposée donne une note<br>supérieure ou égale à toutes les autres dates<br>testées à la main|
|Plan de référence et plan alternatif|L’écart affiché est égal à la différence des<br>deux chiffres|
|Seuils|Un site qui dépasse la nuit maximale est<br>affiché « non respecté », avec un libellé en<br>toutes lettres|
|Lien partagé|Ouvert dans un autre navigateur, il restitue la<br>même vue|
|Mode « Découvrir »|Trois personnes non spécialistes<br>comprennent le scénario sans aide|
|Ressources du défi|L’onglet « Ressources » a été relu aux trois<br>moments prévus et chaque ressource utilisée<br>figure danssources.json|
|Écran de 375 pixels de large|Toutes les pages restent utilisables|



### **11. Ce que nous rendrons** 

L’application en ligne, le dépôt de code avec son README, les fichiers de données précalculées, les fichiers sites.json et sources.json, une vidéo de démonstration de deux minutes qui montre les trois usages (coordination, retard de calendrier, pédagogie), et un court résumé du projet avec une note sur la méthode, les sources et les limites. 

### **12. Calendrier** 

Avant l’événement, nous relisons l’onglet « Ressources » du défi, relevons les coordonnées des sites, téléchargeons les fichiers NAIF et préparons le dépôt. 

Le premier jour, le matin est consacré au calcul sans relief et à sites.json. L’après-midi, nous traitons le relief, calculons le masque d’horizon, exportons les données et faisons les premiers tests. Nous ajoutons aussi la durée de séjour et le décalage de date, car ils conditionnent les usages de planification. 

Le deuxième jour, le matin sert à construire l’interface : choix du site, vue de l’horizon, frise, comparaison de plans et seuils. L’après-midi, nous ajoutons, dans cet ordre, le lien partageable et le récapitulatif, le calendrier des meilleures dates et le mode « Découvrir » si le temps le permet. Nous terminons par les vérifications, la vidéo et le README. Nous relisons l’onglet « Ressources » une dernière fois le matin. 

