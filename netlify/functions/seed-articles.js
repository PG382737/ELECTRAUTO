// One-time seed: insert existing LOCAL_ARTICLES into Supabase
// Hit GET /.netlify/functions/seed-articles?key=<SERVICE_KEY> to run

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supaFetch(endpoint, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        method: options.method || 'GET',
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('json')) return res.json();
    return null;
}

const ARTICLES = [
    {
        title: "Électr'auto : L'importance de prendre soin de votre batterie de voiture",
        title_fr: "Électr'auto : L'importance de prendre soin de votre batterie de voiture",
        title_en: "",
        slug: "prendre-soin-batterie-de-voiture",
        excerpt: "Découvrez pourquoi l'entretien de votre batterie est essentiel et comment Électr'auto peut vous aider à éviter les pannes imprévues.",
        excerpt_fr: "Découvrez pourquoi l'entretien de votre batterie est essentiel et comment Électr'auto peut vous aider à éviter les pannes imprévues.",
        excerpt_en: "",
        image_url: "Images/battery.jpg",
        published: true,
        created_at: "2024-11-15T10:00:00Z",
        content_fr: `<p>Votre batterie de voiture est bien plus qu'un simple composant, c'est le cœur électrique de votre véhicule. Sans elle, rien ne démarre, rien ne fonctionne. Chez Électr'auto, nous comprenons l'importance cruciale d'une batterie en bonne santé pour assurer la fiabilité de votre automobile au quotidien.</p><h2>La Batterie : Un Cœur Électrique</h2><p>La batterie de votre voiture alimente tous les systèmes électriques, du démarrage du moteur aux phares, en passant par le système de divertissement et la climatisation. Une batterie défaillante peut entraîner des pannes inattendues et coûteuses.</p><p>Signes d'une batterie faible :</p><ul><li>Démarrage lent ou difficile du moteur</li><li>Phares qui faiblissent</li><li>Voyant de batterie allumé au tableau de bord</li><li>Systèmes électriques intermittents</li><li>Batterie de plus de 3-4 ans</li></ul><h2>Prévention Plutôt que Réparation</h2><p>Il vaut toujours mieux prévenir que guérir. Un entretien régulier de votre batterie peut prolonger sa durée de vie et vous éviter des désagréments majeurs. Voici quelques conseils :</p><ul><li>Faites vérifier votre batterie à chaque changement de saison</li><li>Nettoyez les bornes régulièrement pour éviter la corrosion</li><li>Évitez de laisser les accessoires électriques en marche moteur éteint</li><li>Assurez-vous que l'alternateur fonctionne correctement</li></ul><p>Le froid québécois est particulièrement dur pour les batteries. Une batterie qui fonctionne bien en été peut faillir dès les premières gelées.</p><h2>Électr'auto : Votre Partenaire de Confiance</h2><p>Chez Électr'auto, nous disposons d'équipements de diagnostic avancés pour tester précisément l'état de votre batterie et de votre système de charge. Notre expertise en systèmes électriques automobiles nous permet d'identifier rapidement les problèmes potentiels.</p><h2>Pourquoi choisir Électr'auto pour vos besoins en batterie ?</h2><ul><li><strong>Expertise :</strong> Plus de 20 ans d'expérience en systèmes électriques automobiles</li><li><strong>Diagnostic précis :</strong> Équipements de pointe pour tester batteries et alternateurs</li><li><strong>Service rapide :</strong> Remplacement de batterie en moins de 30 minutes</li><li><strong>Conseil honnête :</strong> Nous vous dirons si votre batterie a encore de la vie ou s'il est temps de la remplacer</li></ul><p>N'attendez pas d'être en panne pour agir. Contactez-nous pour un diagnostic de votre système électrique et roulez l'esprit tranquille.</p>`,
        content_en: ""
    },
    {
        title: "Réparation de l'air climatisé auto à Québec : Trouvez le meilleur prix sans compromettre la qualité",
        title_fr: "Réparation de l'air climatisé auto à Québec : Trouvez le meilleur prix sans compromettre la qualité",
        title_en: "",
        slug: "reparation-de-lair-climatise-auto-a-quebec-trouvez-le-meilleur-prix-sans-compromettre-la-qualite",
        excerpt: "Guide complet pour la réparation de votre climatisation automobile à Québec. Découvrez les coûts, les signes de problèmes et où faire réparer.",
        excerpt_fr: "Guide complet pour la réparation de votre climatisation automobile à Québec. Découvrez les coûts, les signes de problèmes et où faire réparer.",
        excerpt_en: "",
        image_url: "Images/ac.jpg",
        published: true,
        created_at: "2024-10-28T10:00:00Z",
        content_fr: `<p>Quand l'été québécois frappe avec ses journées chaudes et humides, un système de climatisation automobile en bon état devient indispensable. Mais comment trouver le meilleur prix pour la réparation de l'air climatisé de votre voiture sans compromettre la qualité du service ?</p><h2>Pourquoi la réparation de l'air climatisé est-elle cruciale ?</h2><p>Un système de climatisation défaillant ne se limite pas à un inconfort. Il peut aussi affecter la sécurité de conduite en causant de la fatigue due à la chaleur et en réduisant la visibilité par la condensation sur le pare-brise. De plus, un système qui fuit peut libérer des réfrigérants nocifs pour l'environnement.</p><h2>Comment savoir si votre air climatisé a besoin d'une réparation ?</h2><p>Voici les principaux signes à surveiller :</p><ul><li>L'air soufflé n'est plus aussi froid qu'avant</li><li>Des bruits inhabituels lorsque le système est activé</li><li>Une odeur désagréable provenant des bouches d'aération</li><li>Le système s'active et se désactive de façon intermittente</li><li>Présence de fuite de liquide sous le véhicule</li></ul><h2>Combien coûte la réparation de l'air climatisé auto à Québec ?</h2><p>Le coût de la réparation varie considérablement selon le type de problème :</p><ul><li><strong>Recharge de réfrigérant :</strong> La réparation la plus courante et la moins coûteuse</li><li><strong>Réparation de fuites :</strong> Coût moyen, dépend de l'emplacement de la fuite</li><li><strong>Remplacement du compresseur :</strong> La réparation la plus coûteuse, mais parfois nécessaire</li><li><strong>Remplacement du condenseur ou de l'évaporateur :</strong> Coût variable selon le modèle</li></ul><p>Chez Électr'auto, nous offrons un diagnostic transparent et un devis détaillé avant toute intervention.</p><h2>Où faire réparer votre air climatisé auto à Québec ?</h2><p>Électr'auto Québec est votre spécialiste en réparation de climatisation automobile. Situés au 2485, boulevard Wilfrid-Hamel, nous desservons toute la grande région de Québec. Notre équipe possède l'expertise et les outils nécessaires pour diagnostiquer et réparer tous les types de systèmes de climatisation.</p><h2>Conseils pour maintenir votre air climatisé en bon état</h2><ul><li>Faites fonctionner votre climatisation au moins 10 minutes par semaine, même en hiver</li><li>Remplacez le filtre d'habitacle selon les recommandations du constructeur</li><li>Faites inspecter le système avant chaque saison estivale</li><li>Ne surchargez pas le système en le mettant au maximum dès le démarrage</li></ul>`,
        content_en: ""
    },
    {
        title: "Réparation de climatiseurs automobiles",
        title_fr: "Réparation de climatiseurs automobiles",
        title_en: "",
        slug: "reparation-de-climatiseurs-automobiles",
        excerpt: "Tout ce que vous devez savoir sur la réparation des climatiseurs automobiles modernes et les technologies qui les rendent plus efficaces.",
        excerpt_fr: "Tout ce que vous devez savoir sur la réparation des climatiseurs automobiles modernes et les technologies qui les rendent plus efficaces.",
        excerpt_en: "",
        image_url: "Images/mechanic.jpg",
        published: true,
        created_at: "2024-10-10T10:00:00Z",
        content_fr: `<p>Les climatiseurs automobiles ont considérablement évolué au fil des années. Les véhicules modernes intègrent des systèmes de climatisation sophistiqués qui nécessitent une expertise spécialisée pour leur entretien et leur réparation.</p><h2>Les technologies modernes de climatisation automobile</h2><p>Les véhicules récents utilisent des systèmes de climatisation de plus en plus avancés, avec des contrôles de température bi-zone ou tri-zone, des capteurs de qualité de l'air et des systèmes de filtration haute performance. Ces avancées technologiques améliorent le confort, mais ajoutent aussi de la complexité à la réparation.</p><h2>Importance de la maintenance préventive</h2><p>Un entretien régulier de votre système de climatisation permet de :</p><ul><li>Maintenir une performance optimale de refroidissement</li><li>Prévenir les pannes coûteuses</li><li>Assurer une bonne qualité de l'air dans l'habitacle</li><li>Prolonger la durée de vie des composants</li></ul><h2>Principaux problèmes et solutions</h2><p>Les problèmes les plus fréquents que nous rencontrons incluent les fuites de réfrigérant, les compresseurs défaillants, les condenseurs obstrués et les problèmes électriques dans le circuit de commande. Notre équipement de diagnostic avancé nous permet d'identifier rapidement la source du problème.</p><h2>Notre approche chez Électr'auto</h2><p>Chez Électr'auto, notre approche combine des méthodes de diagnostic éprouvées avec la technologie de pointe. Nous utilisons des détecteurs de fuites électroniques, des manomètres de précision et des outils de diagnostic informatisés pour assurer des réparations exactes et durables.</p><p>Lorsqu'il s'agit de la climatisation de votre véhicule, ne faites pas de compromis. Contactez Électr'auto pour un diagnostic professionnel et une réparation de qualité.</p>`,
        content_en: ""
    },
    {
        title: "Pourquoi choisir Électr'auto pour la réparation de votre climatisation automobile",
        title_fr: "Pourquoi choisir Électr'auto pour la réparation de votre climatisation automobile",
        title_en: "",
        slug: "pourquoi-choisir-electrauto-pour-la-reparation-de-votre-climatisation-automobile",
        excerpt: "Découvrez ce qui distingue Électr'auto des autres ateliers pour la réparation de votre système de climatisation automobile.",
        excerpt_fr: "Découvrez ce qui distingue Électr'auto des autres ateliers pour la réparation de votre système de climatisation automobile.",
        excerpt_en: "",
        image_url: "Images/hero-bg.png",
        published: true,
        created_at: "2024-09-22T10:00:00Z",
        content_fr: `<p>Le choix d'un atelier de réparation pour votre climatisation automobile est une décision importante. Chez Électr'auto, nous comprenons que votre confort et votre sécurité sont en jeu. Voici pourquoi nous sommes le choix de confiance à Québec.</p><h2>La Prise de Diagnostic Moderne</h2><p>Notre atelier est équipé des outils de diagnostic les plus récents du marché. Ces équipements nous permettent d'identifier avec précision l'origine d'un problème de climatisation, qu'il soit mécanique, électrique ou électronique. Un diagnostic précis signifie une réparation efficace et économique.</p><h2>Les véhicules modernes et les systèmes de climatisation</h2><p>Les systèmes de climatisation des véhicules modernes sont intimement liés aux autres systèmes électroniques du véhicule. Un problème de climatisation peut parfois être lié au système de gestion du moteur, aux capteurs de température ou au réseau CAN du véhicule. Notre expertise en électronique automobile nous donne un avantage unique pour résoudre ces problèmes complexes.</p><h2>Le cœur de votre confort</h2><p>Votre système de climatisation fait bien plus que refroidir l'air. Il régule l'humidité, filtre les particules et les allergènes, et contribue à la désembuage de vos vitres. Un système en bon état est essentiel pour votre confort et votre sécurité, particulièrement lors des étés chauds et humides québécois.</p><h2>Pourquoi choisir Électr'auto ?</h2><ul><li><strong>Expertise spécialisée :</strong> Plus de 20 ans d'expérience en systèmes électriques et électroniques automobiles</li><li><strong>Équipement de pointe :</strong> Outils de diagnostic et de réparation dernière génération</li><li><strong>Transparence :</strong> Devis détaillé avant toute intervention</li><li><strong>Garantie :</strong> Nos réparations sont garanties pour votre tranquillité d'esprit</li></ul><h2>Maintenance préventive de la climatisation</h2><p>Nous recommandons une inspection annuelle de votre système de climatisation, idéalement au printemps avant la saison chaude. Cette inspection préventive peut vous éviter des réparations coûteuses et assurer votre confort tout au long de l'été.</p><h2>Soyez prêt pour les saisons</h2><p>Ne laissez pas une panne de climatisation gâcher vos journées d'été. Prenez rendez-vous chez Électr'auto pour un diagnostic complet de votre système de climatisation. Notre équipe qualifiée est prête à vous servir avec professionnalisme et courtoisie.</p>`,
        content_en: ""
    },
    {
        title: "Air climatisé automobile : Qu'est-ce qui est important à savoir",
        title_fr: "Air climatisé automobile : Qu'est-ce qui est important à savoir",
        title_en: "",
        slug: "air-climatise-automobile-quest-ce-qui-est-important-a-savoir",
        excerpt: "Guide complet sur le fonctionnement de la climatisation automobile et les problèmes courants à surveiller.",
        excerpt_fr: "Guide complet sur le fonctionnement de la climatisation automobile et les problèmes courants à surveiller.",
        excerpt_en: "",
        image_url: null,
        published: true,
        created_at: "2024-09-05T10:00:00Z",
        content_fr: `<p>La climatisation automobile est devenue un équipement essentiel dans nos véhicules. Mais savez-vous vraiment comment elle fonctionne et quels sont les signes qui indiquent un problème ? Voici tout ce que vous devez savoir.</p><h2>Comment fonctionne la climatisation automobile ?</h2><p>Le système de climatisation de votre voiture fonctionne sur le principe de la compression et de la détente d'un gaz réfrigérant. Le compresseur comprime le gaz, qui passe ensuite dans le condenseur où il se refroidit et se liquéfie. Le liquide passe par le détendeur, redevient un gaz et absorbe la chaleur de l'habitacle via l'évaporateur.</p><h2>Savez-vous comment fonctionne la climatisation automobile ?</h2><p>Les principaux composants sont :</p><ul><li><strong>Le compresseur :</strong> Le cœur du système, entraîné par la courroie du moteur</li><li><strong>Le condenseur :</strong> Dissipe la chaleur du réfrigérant vers l'extérieur</li><li><strong>L'évaporateur :</strong> Absorbe la chaleur de l'habitacle</li><li><strong>Le détendeur :</strong> Régule le débit de réfrigérant</li><li><strong>Le filtre déshydrateur :</strong> Élimine l'humidité et les impuretés</li></ul><h2>Problèmes importants de climatisation automobile qu'il convient d'inspecter</h2><p>Plusieurs problèmes courants peuvent affecter votre système de climatisation :</p><h3>Avez-vous l'impression qu'il y a beaucoup d'humidité dans le véhicule ?</h3><p>Un excès d'humidité dans l'habitacle peut indiquer un problème avec l'évaporateur ou le système de drainage. L'évaporateur produit normalement de la condensation qui est évacuée sous le véhicule, mais si le drain est bouché, l'eau peut s'accumuler et causer des odeurs de moisissure.</p><h3>Pouvez-vous détecter des odeurs dans l'air ?</h3><p>Des odeurs désagréables peuvent indiquer la présence de moisissures ou de bactéries dans l'évaporateur. Un nettoyage professionnel du système peut résoudre ce problème.</p><h3>Y a-t-il une fuite ?</h3><p>Les fuites de réfrigérant sont l'un des problèmes les plus courants. Elles peuvent se produire au niveau des raccords, des joints ou des composants eux-mêmes. Une fuite même minime réduit l'efficacité du système et doit être réparée.</p><h3>Il est si recommandé de faire fonctionner un climatiseur automobile s'il ne produit que de l'air chaud ?</h3><p>Si votre climatisation ne produit que de l'air chaud, cela peut indiquer un manque de réfrigérant, un compresseur défaillant ou un problème électrique. Il est important de ne pas ignorer ce symptôme.</p><h2>Pourquoi est-il important de bien vérifier l'air conditionné de votre véhicule ?</h2><p>Un système de climatisation en bon état contribue à votre confort, votre santé (filtration de l'air) et même votre sécurité (désembuage efficace). Un entretien régulier est un investissement qui en vaut la peine.</p><h2>Les avantages de la recharge de la climatisation de votre voiture</h2><p>Une recharge régulière du réfrigérant maintient le système à son niveau de performance optimal. Au fil du temps, même un système étanche peut perdre une petite quantité de réfrigérant, ce qui réduit progressivement son efficacité.</p><h2>L'entretien préventif de votre système d'air climatisé d'auto est une bonne idée</h2><p>Chez Électr'auto, nous recommandons un entretien annuel de votre système de climatisation. Cela inclut la vérification du niveau de réfrigérant, l'inspection des composants, le test de performance et le nettoyage du système. Contactez-nous pour prendre rendez-vous.</p>`,
        content_en: ""
    },
    {
        title: "Pourquoi choisir un garage fiable pour votre Volkswagen à Québec ?",
        title_fr: "Pourquoi choisir un garage fiable pour votre Volkswagen à Québec ?",
        title_en: "",
        slug: "pourquoi-choisir-un-garage-fiable-pour-votre-volkswagen-a-quebec",
        excerpt: "Découvrez l'importance de confier votre Volkswagen à un garage de confiance à Québec pour un entretien de qualité.",
        excerpt_fr: "Découvrez l'importance de confier votre Volkswagen à un garage de confiance à Québec pour un entretien de qualité.",
        excerpt_en: "",
        image_url: null,
        published: true,
        created_at: "2024-08-18T10:00:00Z",
        content_fr: `<p>Volkswagen est l'une des marques les plus populaires au Québec, reconnue pour sa fiabilité et ses performances. Cependant, comme tout véhicule, une Volkswagen nécessite un entretien régulier et parfois des réparations spécialisées. Voici pourquoi il est essentiel de choisir un garage fiable pour votre Volkswagen à Québec.</p><h2>Pourquoi est-il vital d'avoir un garage Volkswagen fiable à Québec ?</h2><p>Les véhicules Volkswagen intègrent des technologies avancées, notamment les systèmes TSI et TDI, la transmission DSG, et des systèmes électroniques sophistiqués. Un garage qui connaît bien ces technologies peut diagnostiquer et réparer les problèmes plus efficacement, vous faisant économiser temps et argent.</p><p>Un mécanicien qui comprend les spécificités de Volkswagen pourra :</p><ul><li>Utiliser les bons outils de diagnostic compatibles avec les systèmes VAG</li><li>Identifier rapidement les problèmes courants propres aux modèles VW</li><li>Recommander les intervalles d'entretien appropriés</li><li>Utiliser des pièces de qualité adaptées à votre véhicule</li></ul><p>Chez Électr'auto, notre expertise en systèmes électroniques automobiles nous permet de travailler efficacement sur les véhicules Volkswagen. Nos outils de diagnostic avancés sont compatibles avec tous les systèmes du groupe VAG, ce qui nous permet d'effectuer des diagnostics précis et des réparations de qualité.</p><h2>Ajuster les entretiens fréquents avec une marque fiable comme Volkswagen</h2><p>L'entretien régulier est la clé de la longévité de votre Volkswagen. Voici les entretiens essentiels à ne pas négliger :</p><ul><li><strong>Vidange d'huile :</strong> Essentielle pour la santé du moteur, à faire selon les intervalles recommandés</li><li><strong>Courroie de distribution :</strong> Un remplacement crucial pour éviter des dommages majeurs au moteur</li><li><strong>Système de refroidissement :</strong> Vérification régulière du liquide et des composants</li><li><strong>Freins :</strong> Inspection des plaquettes, disques et liquide de frein</li><li><strong>Transmission DSG :</strong> Vidange du liquide de transmission aux intervalles recommandés</li></ul><p>Contactez Électr'auto pour un entretien complet de votre Volkswagen. Notre équipe qualifiée prendra soin de votre véhicule avec professionnalisme et transparence.</p>`,
        content_en: ""
    },
    {
        title: "Ce que vous devez faire lorsque vous recherchez un atelier de réparation automobile",
        title_fr: "Ce que vous devez faire lorsque vous recherchez un atelier de réparation automobile",
        title_en: "",
        slug: "ce-que-vous-devez-faire-lorsque-vous-recherchez-un-atelier-de-reparation-automobile",
        excerpt: "Conseils pratiques pour trouver un atelier de réparation automobile fiable et compétent dans la région de Québec.",
        excerpt_fr: "Conseils pratiques pour trouver un atelier de réparation automobile fiable et compétent dans la région de Québec.",
        excerpt_en: "",
        image_url: null,
        published: true,
        created_at: "2024-08-01T10:00:00Z",
        content_fr: `<p>Trouver un bon atelier de réparation automobile peut sembler difficile. Entre les grandes chaînes, les concessionnaires et les garages indépendants, le choix est vaste. Voici un guide pour vous aider à faire le bon choix.</p><h2>L'importance de trouver un atelier de réparation automobile fiable</h2><p>Un bon atelier de réparation automobile est un partenaire de confiance pour la durée de vie de votre véhicule. Il vous fournira des diagnostics honnêtes, des réparations de qualité et des recommandations d'entretien préventif qui vous feront économiser à long terme.</p><p>À l'inverse, un mauvais choix peut entraîner des réparations inutiles, des factures gonflées et même des dommages supplémentaires à votre véhicule.</p><h2>Avis Google et sur le Web</h2><p>Avant de choisir un atelier, consultez les avis en ligne. Les avis Google sont particulièrement utiles car ils sont difficiles à falsifier. Regardez :</p><ul><li>La note moyenne (visez 4 étoiles et plus)</li><li>Le nombre total d'avis (plus il y en a, plus la note est fiable)</li><li>Les commentaires détaillés des clients</li><li>Comment l'atelier répond aux avis négatifs</li></ul><h2>Les 4 principaux facteurs à prendre en compte lors du choix d'un bon atelier de réparation automobile</h2><h3>1. Vérifiez leur équipement de diagnostic</h3><p>Un atelier moderne doit disposer d'outils de diagnostic informatisés récents. Les véhicules d'aujourd'hui sont de véritables ordinateurs sur roues, et un bon diagnostic nécessite des outils à la hauteur. Chez Électr'auto, nous investissons continuellement dans les dernières technologies de diagnostic.</p><h3>2. Vérifications d'usage</h3><p>Assurez-vous que l'atelier est bien enregistré, qu'il détient les permis nécessaires et qu'il emploie des mécaniciens certifiés. Un atelier professionnel sera fier de vous montrer ses accréditations.</p><h3>3. Vérifiez qu'ils sont reconnus</h3><p>Un atelier reconnu dans sa communauté est généralement un gage de qualité. Demandez des recommandations à votre entourage, vérifiez si l'atelier est membre d'associations professionnelles et s'il est actif dans la communauté locale.</p><h3>4. Transparence des prix</h3><p>Un bon atelier vous fournira toujours un devis détaillé avant de commencer les travaux. Méfiez-vous des ateliers qui refusent de donner une estimation ou qui ajoutent des frais surprise.</p><h2>En conclusion</h2><p>Prendre le temps de bien choisir son atelier de réparation automobile est un investissement qui en vaut la peine. Chez Électr'auto, nous mettons un point d'honneur à offrir un service transparent, professionnel et courtois depuis plus de 20 ans. N'hésitez pas à nous visiter ou à nous appeler pour constater par vous-même la différence.</p>`,
        content_en: ""
    },
    {
        title: "Réparation air climatisé sur les voitures",
        title_fr: "Réparation air climatisé sur les voitures",
        title_en: "",
        slug: "reparation-air-climatise-sur-les-voitures",
        excerpt: "Voici les principales raisons de faire appel à un technicien qualifié pour la réparation de l'air climatisé de votre véhicule.",
        excerpt_fr: "Voici les principales raisons de faire appel à un technicien qualifié pour la réparation de l'air climatisé de votre véhicule.",
        excerpt_en: "",
        image_url: null,
        published: true,
        created_at: "2024-07-15T10:00:00Z",
        content_fr: `<h2>Réparation air climatisé sur les voitures</h2><p>Voici des raisons de choisir de bons systèmes de réparation pour votre air climatisé automobile. Un système de climatisation automobile défaillant n'est pas qu'un simple inconfort, il peut affecter votre sécurité et la valeur de revente de votre véhicule.</p><h2>Voici des raisons de choisir de bons systèmes de réparations :</h2><ul><li>Un système en bon état maintient une température confortable et sécuritaire dans l'habitacle</li><li>La climatisation aide à désembuer les vitres rapidement, améliorant la visibilité</li><li>Un système bien entretenu consomme moins de carburant</li><li>Les réparations préventives coûtent moins cher que les réparations d'urgence</li></ul><h2>Faites appel à un technicien qualifié pour réparer votre climatisation</h2><p>La réparation d'un système de climatisation automobile requiert des compétences spécifiques et des équipements spécialisés. Le réfrigérant utilisé dans ces systèmes est un produit contrôlé qui doit être manipulé selon des normes strictes pour protéger l'environnement.</p><p>Un technicien qualifié possède :</p><ul><li>La certification pour manipuler les réfrigérants</li><li>Les outils de diagnostic spécialisés</li><li>L'expérience pour identifier rapidement les problèmes</li><li>La connaissance des différents systèmes selon les marques et modèles</li></ul><h2>Pourquoi nous choisir chez Électr'auto ?</h2><p>Chez Électr'auto, nous sommes spécialistes en réparation d'air climatisé pour toutes les marques de véhicules, qu'ils soient populaires ou de prestige. Notre équipe possède plus de 20 ans d'expérience et utilise des équipements de diagnostic à la fine pointe de la technologie.</p><h2>En résumé</h2><p>Ne négligez pas l'entretien de votre système de climatisation. Un système bien entretenu vous gardera au frais pendant les chaudes journées d'été québécois et vous évitera des réparations coûteuses. Contactez Électr'auto dès aujourd'hui pour un diagnostic professionnel.</p>`,
        content_en: ""
    },
    {
        title: "Garage BMW",
        title_fr: "Garage BMW",
        title_en: "",
        slug: "garage-bmw",
        excerpt: "Comment programmer votre ouvre-porte de garage BMW avec HomeLink. Guide complet étape par étape.",
        excerpt_fr: "Comment programmer votre ouvre-porte de garage BMW avec HomeLink. Guide complet étape par étape.",
        excerpt_en: "",
        image_url: null,
        published: true,
        created_at: "2024-06-28T10:00:00Z",
        content_fr: `<p>Les véhicules BMW sont équipés du système HomeLink, un transmetteur universel intégré qui vous permet de programmer l'ouverture de votre porte de garage directement depuis votre voiture. Voici comment le configurer.</p><h2>Comment programmer un ouvre-porte de garage BMW ?</h2><p>La programmation de votre ouvre-porte de garage BMW HomeLink est un processus simple qui peut être réalisé en quelques minutes. Cependant, les étapes exactes peuvent varier légèrement selon le modèle et l'année de votre BMW.</p><h2>Comment fonctionne BMW HomeLink ?</h2><p>HomeLink est un système de transmission radio intégré dans le rétroviseur intérieur ou dans la console de plafond de votre BMW. Il peut mémoriser jusqu'à trois appareils différents (porte de garage, portail, éclairage extérieur, etc.) et les contrôler avec de simples boutons.</p><h2>Comment configurer un ouvre-porte de garage BMW ?</h2><p>Voici les étapes générales pour programmer HomeLink :</p><ol><li>Maintenez enfoncés les deux boutons extérieurs de HomeLink pendant environ 20 secondes pour réinitialiser le système (le voyant clignote rapidement)</li><li>Placez la télécommande de votre porte de garage à environ 5 cm du module HomeLink</li><li>Appuyez simultanément sur le bouton de la télécommande et sur le bouton HomeLink souhaité</li><li>Maintenez les deux boutons jusqu'à ce que le voyant HomeLink clignote rapidement</li><li>Relâchez les boutons, la programmation est enregistrée</li></ol><h2>La configuration est terminée et votre HomeLink est maintenant prêt</h2><p>Une fois la programmation terminée, testez le système en appuyant sur le bouton HomeLink programmé à portée de votre porte de garage. Si la porte s'ouvre, la programmation est réussie. Sinon, vous devrez peut-être synchroniser le récepteur de votre porte de garage en appuyant sur son bouton d'apprentissage.</p><h2>Conseils et mesures de sécurité pour la programmation de BMW HomeLink</h2><ul><li>Effectuez la programmation dans un endroit sûr, moteur éteint</li><li>Assurez-vous que personne ne se trouve dans le chemin de la porte de garage pendant les tests</li><li>Si la programmation ne fonctionne pas, vérifiez la pile de votre télécommande</li><li>Certains ouvre-portes plus récents nécessitent une étape de synchronisation supplémentaire</li></ul><h2>Conclusion</h2><p>Si vous avez des difficultés à programmer votre système HomeLink ou si vous avez besoin d'aide avec tout autre aspect électronique de votre BMW, Électr'auto est là pour vous. Notre expertise en systèmes électroniques BMW nous permet de résoudre rapidement tout problème de programmation ou de configuration.</p>`,
        content_en: ""
    },
    {
        title: "Entretien de votre BMW à Québec",
        title_fr: "Entretien de votre BMW à Québec",
        title_en: "",
        slug: "entretien-de-votre-bmw-a-quebec",
        excerpt: "Guide complet sur l'entretien de votre BMW à Québec : coûts, routine d'entretien et conseils d'experts.",
        excerpt_fr: "Guide complet sur l'entretien de votre BMW à Québec : coûts, routine d'entretien et conseils d'experts.",
        excerpt_en: "",
        image_url: null,
        published: true,
        created_at: "2024-06-10T10:00:00Z",
        content_fr: `<p>Posséder une BMW est un plaisir de conduite incomparable. Mais pour maintenir les performances et la fiabilité de votre véhicule allemand, un entretien régulier et bien fait est indispensable. Voici votre guide complet pour l'entretien de votre BMW à Québec.</p><h2>L'importance de consulter un expert lors de l'achat d'une BMW d'occasion à Québec</h2><p>Si vous envisagez l'achat d'une BMW d'occasion, une inspection pré-achat par un spécialiste est fortement recommandée. Les BMW sont des véhicules sophistiqués, et certains problèmes peuvent ne pas être apparents lors d'un essai routier. Un expert pourra vérifier les systèmes électroniques, le moteur, la transmission et l'état général du véhicule.</p><h2>Avantages que des pièces directes de la concession d'un expert</h2><p>Chez Électr'auto, nous avons accès à des pièces de qualité équivalente aux pièces d'origine, souvent à un coût inférieur à celui du concessionnaire. Nous pouvons également installer des pièces d'origine BMW si vous le préférez.</p><h2>Le coût d'un entretien BMW régulier à Québec</h2><p>L'entretien d'une BMW peut sembler plus coûteux que celui d'un véhicule ordinaire, mais un entretien régulier prévient les réparations majeures et protège la valeur de revente de votre véhicule. Chez Électr'auto, nous offrons des tarifs compétitifs pour l'entretien BMW, tout en maintenant des standards de qualité élevés.</p><h2>La routine d'entretien BMW général</h2><p>Voici les principaux points d'entretien à suivre pour votre BMW :</p><h3>Changement d'huile</h3><p>BMW recommande un changement d'huile tous les 15 000 km ou une fois par an, selon ce qui vient en premier. Utilisez toujours une huile conforme aux spécifications BMW (BMW Longlife-01 ou LL-04 selon le moteur). Chez Électr'auto, nous effectuons la vidange d'huile en moins de 30 minutes.</p><h3>Bien quelles raisons supplémentaires de le faire ?</h3><p>Au-delà de la lubrification, l'huile moteur nettoie, refroidit et protège les composants internes du moteur. Une huile usée perd ses propriétés et peut endommager votre moteur.</p><h3>En finir avec les pannes</h3><p>Un entretien régulier est la meilleure assurance contre les pannes inattendues. Les BMW modernes sont équipées de systèmes d'alerte d'entretien (CBS - Condition Based Service), mais ne vous fiez pas uniquement à ces alertes.</p><h3>Remplacement de l'antigel et du liquide de refroidissement</h3><p>Le système de refroidissement BMW nécessite un liquide de refroidissement spécifique. Un remplacement régulier prévient la corrosion du système et assure une protection optimale contre le gel québécois.</p><h3>Nettoyage d'air</h3><p>Le filtre à air et le filtre d'habitacle doivent être remplacés régulièrement pour assurer des performances optimales du moteur et une bonne qualité de l'air dans l'habitacle.</p><h2>Conclusion</h2><p>L'entretien de votre BMW est un investissement dans la longévité et les performances de votre véhicule. Chez Électr'auto à Québec, nous sommes spécialistes BMW et nous mettons notre expertise à votre service. Contactez-nous au 1.418.666.9769 pour prendre rendez-vous.</p>`,
        content_en: ""
    }
];

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };
    }

    // Simple protection
    const params = event.queryStringParameters || {};
    if (params.confirm !== 'yes') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Add ?confirm=yes to run' }) };
    }

    try {
        // Check if articles already exist
        const existing = await supaFetch('articles?limit=1');
        if (existing && existing.length > 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Articles already exist, skipping seed', count: existing.length }) };
        }

        const results = [];
        for (const article of ARTICLES) {
            const row = {
                title: article.title,
                title_fr: article.title_fr,
                title_en: article.title_en,
                slug: article.slug,
                content: article.content_fr,
                content_fr: article.content_fr,
                content_en: article.content_en,
                excerpt: article.excerpt,
                excerpt_fr: article.excerpt_fr,
                excerpt_en: article.excerpt_en,
                image_url: article.image_url,
                published: article.published,
                created_at: article.created_at
            };

            const data = await supaFetch('articles', {
                method: 'POST',
                body: row,
                prefer: 'return=representation'
            });
            results.push(data[0]?.slug || 'ok');
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ success: true, inserted: results.length, slugs: results })
        };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
