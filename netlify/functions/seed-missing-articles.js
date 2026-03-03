// One-time seed: insert 2 missing old blog articles into Supabase
// Hit GET /.netlify/functions/seed-missing-articles?key=<SERVICE_KEY> to run

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
        title: "Entretien véhicule hybride à Québec",
        title_fr: "Entretien véhicule hybride à Québec",
        title_en: "Hybrid Vehicle Maintenance in Quebec City",
        slug: "entretien-vehicule-hybride",
        excerpt: "Vous recherchez un atelier fiable pour confier l'entretien de votre véhicule hybride à Québec? Électr'auto dispose de tout l'équipement nécessaire.",
        excerpt_fr: "Vous recherchez un atelier fiable pour confier l'entretien de votre véhicule hybride à Québec? Électr'auto dispose de tout l'équipement nécessaire.",
        excerpt_en: "Looking for a reliable shop for your hybrid vehicle maintenance in Quebec City? Électr'auto has all the necessary equipment.",
        image_url: null,
        published: true,
        created_at: "2024-06-15T10:00:00Z",
        content_fr: `<p>Vous recherchez un atelier fiable pour confier l'entretien de votre véhicule hybride dans les environs de la ville de Québec? Ne cherchez plus.</p><h2>Votre spécialiste véhicule hybride à Québec</h2><p>Électr'auto dispose de tout l'équipement ainsi que la compétence nécessaire pour l'entretien et la réparation de votre véhicule hybride. Notre équipe possède une expertise approfondie des systèmes hybrides de toutes les marques, incluant Toyota, Honda, Hyundai, Kia et bien d'autres.</p><h2>Pourquoi confier votre hybride à Électr'auto?</h2><ul><li><strong>Équipement spécialisé :</strong> Outils de diagnostic avancés pour les systèmes hybrides et électriques</li><li><strong>Expertise technique :</strong> Formation continue sur les nouvelles technologies hybrides</li><li><strong>Entretien complet :</strong> Batterie haute tension, système de freinage régénératif, moteur électrique et thermique</li><li><strong>Service honnête :</strong> Recommandations transparentes adaptées à votre véhicule</li></ul><h2>Services offerts pour véhicules hybrides</h2><p>Nous offrons une gamme complète de services pour votre véhicule hybride :</p><ul><li>Diagnostic du système hybride et des batteries haute tension</li><li>Entretien préventif adapté aux véhicules hybrides</li><li>Réparation du système de freinage régénératif</li><li>Vérification et entretien du système de climatisation</li><li>Entretien mécanique général (freins, suspension, direction)</li><li>Mise à jour des logiciels de bord</li></ul><p>Communiquez avec nous pour un rendez-vous rapide et sans tracas. Pour l'entretien de votre véhicule hybride à Québec, appelez-nous au <strong>418 666-9769</strong> ou écrivez-nous à <a href="mailto:info@electrautoquebec.com">info@electrautoquebec.com</a>.</p>`,
        content_en: `<p>Looking for a reliable shop to entrust the maintenance of your hybrid vehicle in the Quebec City area? Look no further.</p><h2>Your Hybrid Vehicle Specialist in Quebec City</h2><p>Électr'auto has all the equipment and expertise needed for the maintenance and repair of your hybrid vehicle. Our team has in-depth knowledge of hybrid systems from all brands, including Toyota, Honda, Hyundai, Kia, and many more.</p><h2>Why Trust Électr'auto with Your Hybrid?</h2><ul><li><strong>Specialized equipment:</strong> Advanced diagnostic tools for hybrid and electric systems</li><li><strong>Technical expertise:</strong> Ongoing training on new hybrid technologies</li><li><strong>Complete maintenance:</strong> High-voltage battery, regenerative braking, electric and thermal motors</li><li><strong>Honest service:</strong> Transparent recommendations tailored to your vehicle</li></ul><h2>Services Offered for Hybrid Vehicles</h2><p>We offer a full range of services for your hybrid vehicle:</p><ul><li>Hybrid system and high-voltage battery diagnostics</li><li>Preventive maintenance adapted to hybrid vehicles</li><li>Regenerative braking system repair</li><li>Air conditioning system inspection and maintenance</li><li>General mechanical maintenance (brakes, suspension, steering)</li><li>Onboard software updates</li></ul><p>Contact us for a quick, hassle-free appointment. For hybrid vehicle maintenance in Quebec City, call us at <strong>418 666-9769</strong> or email us at <a href="mailto:info@electrautoquebec.com">info@electrautoquebec.com</a>.</p>`
    },
    {
        title: "Entretien des freins sur voiture électrique",
        title_fr: "Entretien des freins sur voiture électrique",
        title_en: "Brake Maintenance on Electric Cars",
        slug: "entretien-des-freins-sur-voiture-electrique",
        excerpt: "L'entretien des freins sur votre voiture électrique se fait différemment. Découvrez pourquoi et comment Électr'auto peut vous aider.",
        excerpt_fr: "L'entretien des freins sur votre voiture électrique se fait différemment. Découvrez pourquoi et comment Électr'auto peut vous aider.",
        excerpt_en: "Brake maintenance on your electric car is done differently. Find out why and how Électr'auto can help.",
        image_url: null,
        published: true,
        created_at: "2024-06-01T10:00:00Z",
        content_fr: `<p>Vous êtes l'heureux propriétaire d'une voiture électrique, qu'elle soit hybride ou 100% électrique? L'entretien des freins sur votre voiture se fait d'une autre manière que celle utilisée sur les voitures à essence.</p><h2>Les freins régénératifs : un avantage pour vos freins</h2><p>Lorsque vous freinez, une partie de la force de traction est rétro-inversée (freins régénératifs) pour recharger votre batterie. Cette première portion du freinage permet à vos freins mécaniques d'être moins sollicités. C'est un bon avantage sur les coûts de remplacement de freins.</p><p>Il est cependant important de faire l'entretien de vos freins sur votre voiture électrique de manière périodique. Les experts recommandent de faire entretenir vos freins <strong>au moins une fois par année</strong>.</p><h2>Ce que comprend un entretien de freins</h2><ul><li>Nettoyer les étriers et appliquer de la graisse prévue à cet effet</li><li>Vérifier l'état des freins avec des outils de précision</li><li>Valider la performance du système de freinage</li><li>Remettre les freins en position avec l'ajustement nécessaire</li><li>Enlever toute trace de rouille sur les surfaces de contact</li></ul><h2>Pourquoi la rouille est votre ennemi</h2><p>Une tâche importante d'entretien est d'enlever toute trace de formation de rouille et autres débris qui se sont fusionnés sur la surface en contact avec vos plaquettes de freinage. En nettoyant cette surface, vos freins reprennent de leur efficacité et permettent un freinage efficace en situation d'urgence.</p><p>Même si vous ne prenez votre voiture que pour aller au travail et faites peu de kilométrage, cet élément est tout aussi important. La rouille se développe avec l'humidité et puisque vos freins sont en contact avec la chaussée humide, il est important de faire entretenir vos freins par un mécanicien expérimenté.</p><h2>Un look plus propre en bonus</h2><p>D'un côté esthétique, il est possible de repeindre couleur argent vos disques de freins pour éliminer les petites taches restantes de rouille, ce qui rend le look de votre voiture plus attrayant.</p><h2>Électr'auto : experts en voitures électriques</h2><p>Chez Électr'auto, les voitures électriques comme Tesla, Chevrolet Bolt, Nissan Leaf et autres n'ont plus de secrets. Nous sommes passés maîtres dans les entretiens préventifs comme les réparations. Nous disposons des connaissances techniques et des outils pour communiquer tous les entretiens faits aux ordinateurs de bord, une étape essentielle pour effacer les témoins lumineux dans le tableau de bord.</p><p>Prenez rendez-vous avec nous dès aujourd'hui au <strong>418 666-9769</strong> ou à <a href="mailto:info@electrautoquebec.com">info@electrautoquebec.com</a>.</p>`,
        content_en: `<p>Are you the proud owner of an electric car, whether hybrid or 100% electric? Brake maintenance on your vehicle is done differently than on gasoline-powered cars.</p><h2>Regenerative Braking: An Advantage for Your Brakes</h2><p>When you brake, part of the traction force is reversed (regenerative braking) to recharge your battery. This first portion of braking allows your mechanical brakes to be less stressed. This is a great advantage on brake replacement costs.</p><p>However, it's important to have your brakes maintained on a periodic basis. Experts recommend having your brakes serviced <strong>at least once a year</strong>.</p><h2>What Brake Maintenance Includes</h2><ul><li>Cleaning calipers and applying proper grease</li><li>Checking brake condition with precision tools</li><li>Validating braking system performance</li><li>Resetting brakes with necessary adjustments</li><li>Removing all rust traces from contact surfaces</li></ul><h2>Why Rust Is Your Enemy</h2><p>An important maintenance task is removing all rust formation and debris fused onto the surface in contact with your brake pads. By cleaning this surface, your brakes regain their effectiveness and provide efficient braking in emergency situations.</p><p>Even if you only use your car to commute and drive few kilometers per year, this element is just as important. Rust develops with humidity, and since your brakes are in contact with wet roads, it's important to have them maintained by an experienced mechanic.</p><h2>A Cleaner Look as a Bonus</h2><p>From an aesthetic standpoint, it's possible to repaint your brake discs silver to eliminate small remaining rust spots, giving your car a more attractive look.</p><h2>Électr'auto: Electric Car Experts</h2><p>At Électr'auto, electric cars like Tesla, Chevrolet Bolt, Nissan Leaf and others hold no secrets for us. We've mastered both preventive maintenance and repairs. We have the technical knowledge and tools to communicate all maintenance performed to onboard computers — an essential step to clear warning lights on your dashboard.</p><p>Book an appointment with us today at <strong>418 666-9769</strong> or at <a href="mailto:info@electrautoquebec.com">info@electrautoquebec.com</a>.</p>`
    },
    {
        title: "Diagnostic électronique avancé",
        title_fr: "Diagnostic électronique avancé",
        title_en: "Advanced Electronic Diagnostics",
        slug: "diagnostic-electronique-avance",
        excerpt: "Électr'auto offre un service de diagnostic électronique avancé pour identifier rapidement et précisément les problèmes de votre véhicule.",
        excerpt_fr: "Électr'auto offre un service de diagnostic électronique avancé pour identifier rapidement et précisément les problèmes de votre véhicule.",
        excerpt_en: "Électr'auto offers advanced electronic diagnostics to quickly and accurately identify your vehicle's problems.",
        image_url: null,
        published: true,
        created_at: "2024-05-15T10:00:00Z",
        content_fr: `<p>Les véhicules modernes sont équipés de dizaines de capteurs et de modules électroniques qui communiquent entre eux pour assurer le bon fonctionnement de votre voiture. Lorsqu'un problème survient, un diagnostic électronique avancé est essentiel pour identifier rapidement et précisément la source du problème.</p><h2>Qu'est-ce que le diagnostic électronique avancé?</h2><p>Le diagnostic électronique va bien au-delà de la simple lecture des codes d'erreur. Chez Électr'auto, nous utilisons des équipements de diagnostic de pointe qui nous permettent de :</p><ul><li>Lire et interpréter les codes d'erreur de tous les modules du véhicule</li><li>Effectuer des tests en temps réel sur les capteurs et actuateurs</li><li>Analyser les données en direct du réseau CAN Bus</li><li>Programmer et configurer les modules électroniques</li><li>Mettre à jour les logiciels de bord</li></ul><h2>Problèmes courants détectés par le diagnostic</h2><p>Notre service de diagnostic permet de détecter une grande variété de problèmes :</p><ul><li><strong>Témoins lumineux :</strong> Check engine, ABS, airbag, pression des pneus et autres</li><li><strong>Problèmes de performance :</strong> Ratés d'allumage, consommation excessive, perte de puissance</li><li><strong>Systèmes de sécurité :</strong> ABS, contrôle de traction, stabilité électronique</li><li><strong>Transmission :</strong> Problèmes de passage de vitesses, glissement</li><li><strong>Système électrique :</strong> Batterie, alternateur, démarreur, circuits électriques</li></ul><h2>Pourquoi choisir Électr'auto pour votre diagnostic?</h2><p>Depuis 2006, Électr'auto est reconnu comme le spécialiste des problèmes électroniques et électriques automobiles à Québec. Notre expertise couvre toutes les marques, avec une spécialisation particulière pour les véhicules BMW, Audi et autres marques européennes.</p><ul><li><strong>Équipement professionnel :</strong> Outils de diagnostic de niveau concessionnaire</li><li><strong>Expertise :</strong> Près de 20 ans d'expérience en diagnostic électronique</li><li><strong>Toutes marques :</strong> Nous diagnostiquons tous les véhicules, européens, asiatiques et américains</li><li><strong>Transparence :</strong> Rapport détaillé et explication claire du diagnostic</li></ul><p>N'attendez pas qu'un petit problème devienne une grosse réparation. Contactez-nous au <strong>418 666-9769</strong> ou à <a href="mailto:info@electrautoquebec.com">info@electrautoquebec.com</a> pour un diagnostic complet de votre véhicule.</p>`,
        content_en: `<p>Modern vehicles are equipped with dozens of sensors and electronic modules that communicate with each other to ensure your car runs properly. When a problem occurs, advanced electronic diagnostics are essential to quickly and accurately identify the source of the issue.</p><h2>What Is Advanced Electronic Diagnostics?</h2><p>Electronic diagnostics go far beyond simply reading error codes. At Électr'auto, we use state-of-the-art diagnostic equipment that allows us to:</p><ul><li>Read and interpret error codes from all vehicle modules</li><li>Perform real-time tests on sensors and actuators</li><li>Analyze live data from the CAN Bus network</li><li>Program and configure electronic modules</li><li>Update onboard software</li></ul><h2>Common Problems Detected by Diagnostics</h2><p>Our diagnostic service can detect a wide variety of problems:</p><ul><li><strong>Warning lights:</strong> Check engine, ABS, airbag, tire pressure, and others</li><li><strong>Performance issues:</strong> Misfires, excessive fuel consumption, power loss</li><li><strong>Safety systems:</strong> ABS, traction control, electronic stability</li><li><strong>Transmission:</strong> Shifting problems, slipping</li><li><strong>Electrical system:</strong> Battery, alternator, starter, electrical circuits</li></ul><h2>Why Choose Électr'auto for Your Diagnostics?</h2><p>Since 2006, Électr'auto has been recognized as the specialist in electronic and electrical automotive problems in Quebec City. Our expertise covers all makes, with particular specialization in BMW, Audi, and other European vehicles.</p><ul><li><strong>Professional equipment:</strong> Dealer-level diagnostic tools</li><li><strong>Expertise:</strong> Nearly 20 years of experience in electronic diagnostics</li><li><strong>All makes:</strong> We diagnose all vehicles — European, Asian, and American</li><li><strong>Transparency:</strong> Detailed report and clear explanation of the diagnosis</li></ul><p>Don't wait for a small problem to become a major repair. Contact us at <strong>418 666-9769</strong> or at <a href="mailto:info@electrautoquebec.com">info@electrautoquebec.com</a> for a complete diagnosis of your vehicle.</p>`
    }
];

exports.handler = async (event) => {
    const params = event.queryStringParameters || {};
    if (params.key !== SUPABASE_SERVICE_KEY) {
        return { statusCode: 401, body: 'Unauthorized — pass ?key=SERVICE_KEY' };
    }

    const results = [];
    for (const art of ARTICLES) {
        try {
            // Check if slug already exists
            const existing = await supaFetch(`articles?slug=eq.${encodeURIComponent(art.slug)}&limit=1`);
            if (existing && existing.length > 0) {
                results.push({ slug: art.slug, status: 'already exists' });
                continue;
            }

            const row = {
                title: art.title,
                title_fr: art.title_fr,
                title_en: art.title_en,
                slug: art.slug,
                content: art.content_fr,
                content_fr: art.content_fr,
                content_en: art.content_en,
                excerpt: art.excerpt,
                excerpt_fr: art.excerpt_fr,
                excerpt_en: art.excerpt_en,
                image_url: art.image_url,
                published: art.published,
                created_at: art.created_at
            };

            await supaFetch('articles', { method: 'POST', body: row, prefer: 'return=minimal' });
            results.push({ slug: art.slug, status: 'created' });
        } catch (e) {
            results.push({ slug: art.slug, status: 'error', message: e.message });
        }
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
    };
};
