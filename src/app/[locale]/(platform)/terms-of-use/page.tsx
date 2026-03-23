import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata(): Promise<Metadata> {
  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name

  return {
    title: 'Terms of Use',
    description: `Terms of Use for ${siteName}`,
  }
}

export default async function TermsOfUsePage({ params }: PageProps<'/[locale]/terms-of-use'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name
  const siteNameUpper = siteName.toUpperCase()
  const siteUrl = (process.env.SITE_URL?.trim()?.replace(/\/$/, '') ?? '') || undefined

  return (
    <main className="container mx-auto max-w-4xl space-y-10 py-12 leading-relaxed text-foreground dark:text-foreground">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {siteName}
          {' '}
          Terms of Use
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated: March 23, 2026
        </p>
      </header>

      {/* ── Introduction ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Introduction</h2>
        <p>
          These Terms of Use (&ldquo;Terms&rdquo;) are entered into between you (&ldquo;you,&rdquo; &ldquo;your,&rdquo; or
          &ldquo;User&rdquo;) and Axes LLC (&ldquo;the Company,&rdquo; &ldquo;
          {siteName}
          ,&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a limited liability company duly incorporated under the laws of
          Saint Vincent and the Grenadines.
        </p>
        <p>
          These Terms govern your access to and use of the following:
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            <strong>Content Features</strong>
            {' '}
            (optional): Informational content, data, commentary, research, analytics,
            educational materials, and other information relating to markets, events, or other topics that may be made
            available through the Interfaces (&ldquo;Content Features&rdquo;). Content Features are provided for general
            informational purposes only and do not constitute financial, investment, legal, tax, or other professional
            advice.
          </li>
          <li>
            <strong>Technology Features</strong>
            : Interfaces that allow you to connect a self-hosted cryptocurrency
            wallet (&ldquo;Wallet&rdquo;) to broadcast transactions to supported blockchain networks to interact with
            event-based binary outcome contracts or similar on-chain mechanisms (&ldquo;Contracts&rdquo;) in a
            non-custodial manner, together with any related user interface components (the &ldquo;Technology
            Features&rdquo;).
          </li>
          <li>
            <strong>Platform</strong>
            : The combination of Content Features and Technology Features, together with any
            supporting infrastructure, APIs, and services made available by
            {' '}
            {siteName}
            {' '}
            (the &ldquo;Platform&rdquo;).
          </li>
          <li>
            <strong>Site</strong>
            : The website located at
            {' '}
            {siteUrl}
            , including all subdomains, and any successor URLs
            (the &ldquo;Site&rdquo;).
          </li>
          <li>
            <strong>Interfaces</strong>
            : The Site, any mobile applications, browser extensions, widgets, APIs, and any
            other means through which
            {' '}
            {siteName}
            {' '}
            makes the Platform available (collectively, the
            &ldquo;Interfaces&rdquo;).
          </li>
          <li>
            <strong>Features</strong>
            : Content Features, Technology Features, and all other features, tools,
            functionalities, and services available through the Interfaces (collectively, &ldquo;Features&rdquo;).
          </li>
        </ul>
        <p>
          The Terms include any policies, guidelines, or supplemental documents that expressly incorporate these Terms by
          reference, as well as our Privacy Policy (collectively, the &ldquo;Agreement&rdquo;). By accessing or using any
          Interface or Feature, you acknowledge that you have read, understood, and agree to be bound by this Agreement. If
          you are accessing or using the Interfaces or Features on behalf of an entity, you represent and warrant that you
          have the authority to bind such entity to this Agreement, and all references to &ldquo;you&rdquo; shall include
          such entity.
        </p>
        <p className="font-medium">
          NOTICE: PLEASE READ THESE TERMS CAREFULLY. BY ACCESSING OR USING ANY INTERFACE OR FEATURE (INCLUDING, WITHOUT
          LIMITATION, CONNECTING A SELF-HOSTED WALLET, CREATING AN ACCOUNT OR IDENTIFIER, OR INTERACTING WITH ANY CONTRACT
          OR MARKET), YOU REPRESENT THAT YOU ARE LEGALLY ABLE TO ENTER INTO A BINDING AGREEMENT AND THAT YOU HAVE READ,
          UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS IN THEIR ENTIRETY, INCLUDING THE BINDING ARBITRATION CLAUSE AND
          CLASS ACTION WAIVER SET FORTH BELOW. IF YOU DO NOT AGREE TO ANY PART OF THESE TERMS, YOU MUST NOT ACCESS OR USE
          THE INTERFACES OR FEATURES.
        </p>
        <p className="font-medium">
          RESTRICTED PERSONS: THE TECHNOLOGY FEATURES ARE NOT OFFERED TO AND MAY NOT BE USED BY PERSONS OR ENTITIES WHO
          RESIDE IN, ARE LOCATED IN, ARE INCORPORATED IN, HAVE A REGISTERED OFFICE IN, OR HAVE THEIR PRINCIPAL PLACE OF
          BUSINESS IN THE UNITED STATES OF AMERICA OR ANY OTHER RESTRICTED JURISDICTION (AS DEFINED BELOW). IF YOU ARE A
          RESTRICTED PERSON, DO NOT ATTEMPT TO ACCESS OR USE THE TECHNOLOGY FEATURES. USE OF A VIRTUAL PRIVATE NETWORK
          (&ldquo;VPN&rdquo;) OR ANY OTHER PRIVACY OR ANONYMIZATION TOOL OR TECHNIQUE TO CIRCUMVENT OR ATTEMPT TO
          CIRCUMVENT ANY RESTRICTIONS THAT APPLY IS STRICTLY PROHIBITED.
        </p>
      </section>

      {/* ── The Site and Features ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">The Site and Features</h2>
        <p>
          The Site and Features provide access to information about event-based markets and, through the Technology
          Features, allow you to interact with Contracts deployed on supported blockchain networks. The Platform may
          display market data, pricing information, probabilities, event outcomes, historical data, and other
          informational content. All such information is provided for general informational and educational purposes only
          and does not constitute an offer, solicitation, recommendation, endorsement, or advice of any kind.
        </p>
        <p>
          <strong>Non-Custodial Nature.</strong>
          {' '}
          {siteName}
          {' '}
          does not operate a centralized exchange, does not provide trade execution or clearing services, does not take
          possession or custody of your digital assets at any time, and does not act as your agent, broker, dealer,
          fiduciary, or counterparty.
          {' '}
          {siteName}
          {' '}
          does not hold, control, or have access to your funds, tokens, or other digital assets. All transactions you
          initiate through the Technology Features are executed directly on the relevant blockchain network through
          smart contracts. You retain full control of your Wallet and assets at all times.
        </p>
        <p>
          <strong>Wallet Responsibilities.</strong>
          {' '}
          When you connect a Wallet to the Interfaces, you understand and agree
          that:
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            You are solely responsible for the security and management of your Wallet, including safeguarding all
            private keys, seed phrases, recovery phrases, passwords, PINs, and other security credentials. Loss of
            these credentials may result in the permanent and irreversible loss of your digital assets.
          </li>
          <li>
            {siteName}
            {' '}
            cannot access your private keys, cannot reverse, cancel, or modify any transaction you have initiated, and
            cannot control, guarantee, or ensure the success, timing, or outcome of any transaction.
          </li>
          <li>
            Transactions may require the payment of non-refundable network fees (commonly referred to as &ldquo;gas
            fees&rdquo;), which are determined by the relevant blockchain network and are solely your responsibility.
            {' '}
            {siteName}
            {' '}
            does not receive, benefit from, or have any control over such fees.
          </li>
        </ul>
        <p>
          <strong>Blockchain Risks.</strong>
          {' '}
          You acknowledge that blockchain technology is inherently subject to risks,
          including but not limited to: smart-contract bugs or vulnerabilities; protocol-level exploits; network
          congestion, delays, or outages; blockchain reorganizations or forks; validator or miner failures; front-running
          or MEV extraction by third parties; and the irreversible nature of blockchain transactions. You assume all
          risks associated with interacting with blockchain networks and smart contracts.
        </p>
        <p>
          <strong>Third-Party Infrastructure.</strong>
          {' '}
          The Interfaces and Features rely on third-party infrastructure,
          including but not limited to blockchain networks, validators, nodes, RPC providers, oracles, indexers, bridges,
          and data providers.
          {' '}
          {siteName}
          {' '}
          does not own, operate, or control any of these third-party systems and makes no representations, warranties, or
          guarantees regarding their availability, reliability, accuracy, security, or performance.
        </p>
        <p>
          <strong>Contract Resolution.</strong>
          {' '}
          Resolution of Contracts (where applicable) occurs solely in accordance
          with the market-specific rules and any third-party oracle or dispute resolution mechanism referenced in the
          relevant market terms. Resolution outcomes are determined by the applicable oracle or resolution source and are
          final once settled on-chain.
          {' '}
          {siteName}
          {' '}
          does not control, determine, or guarantee resolution outcomes and is not responsible for disputes between
          market participants regarding resolution.
        </p>
        <p>
          <strong>Pricing.</strong>
          {' '}
          Any pricing, probability, or market data displayed on the Interfaces is provided
          for informational purposes only. Such data may be delayed, inaccurate, or incomplete and does not constitute
          an offer, bid, ask, or guaranteed price at which any transaction can be executed. Actual execution prices may
          differ materially from displayed prices.
        </p>
        <p>
          <strong>Site Availability.</strong>
          {' '}
          {siteName}
          {' '}
          does not guarantee that the Site, Interfaces, or Features will be available at all times or without
          interruption. The Site, Interfaces, or Features may be unavailable from time to time due to maintenance,
          upgrades, technical issues, force majeure events, or other reasons. We reserve the right to modify, suspend,
          or discontinue any part of the Site, Interfaces, or Features (including placing Features in a close-only or
          read-only mode) at any time, with or without notice, and without liability to you.
        </p>
      </section>

      {/* ── Eligibility; Sanctions; Restricted Jurisdictions ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Eligibility; Sanctions; Restricted Jurisdictions</h2>
        <p>
          By accessing or using the Interfaces or Features, you represent and warrant that:
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            <strong>Age.</strong>
            {' '}
            You are at least 18 years of age (or the age of majority in your jurisdiction,
            whichever is higher) and have the legal capacity and authority to enter into this Agreement.
          </li>
          <li>
            <strong>Sanctions Compliance.</strong>
            {' '}
            You are not, and are not acting on behalf of, any person or entity
            that is (a) identified on any sanctions list maintained by the U.S. Office of Foreign Assets Control
            (&ldquo;OFAC&rdquo;), the European Union, the United Kingdom, the United Nations Security Council, or any
            other applicable governmental authority; (b) located in, organized in, or a resident of any country or
            territory that is the subject of comprehensive country-wide or territory-wide sanctions; or (c) otherwise
            blocked or prohibited from transacting under applicable sanctions, anti-money laundering (&ldquo;AML&rdquo;),
            or counter-terrorist financing (&ldquo;CTF&rdquo;) laws and regulations.
          </li>
          <li>
            <strong>Restricted Jurisdictions.</strong>
            {' '}
            You are not accessing, using, or attempting to use the Technology
            Features (including trading or interacting with Contracts) from any jurisdiction in which such activity is
            prohibited or restricted (&ldquo;Restricted Jurisdictions&rdquo;). Without limiting the foregoing, use of the
            Technology Features for trading or interacting with Contracts is not permitted by persons or entities who
            reside in, are located in, are incorporated in, have a registered office in, or have their principal place of
            business in: the
            <strong>United States of America</strong>
            , the
            <strong>United Kingdom</strong>
            ,
            {' '}
            <strong>France</strong>
            ,
            <strong>Ontario (Canada)</strong>
            ,
            <strong>Singapore</strong>
            ,
            {' '}
            <strong>Poland</strong>
            ,
            <strong>Thailand</strong>
            ,
            <strong>Australia</strong>
            ,
            <strong>Belgium</strong>
            ,
            {' '}
            <strong>Taiwan</strong>
            , or any comprehensively sanctioned country or region (including, without limitation,
            {' '}
            <strong>Iran</strong>
            ,
            <strong>Syria</strong>
            ,
            <strong>Cuba</strong>
            ,
            <strong>North Korea</strong>
            , and the
            {' '}
            <strong>Crimea</strong>
            ,
            <strong>Donetsk</strong>
            , or
            <strong>Luhansk</strong>
            {' '}
            regions), or in any other
            jurisdiction where applicable law prohibits such use.
          </li>
          <li>
            <strong>VPN Prohibition.</strong>
            {' '}
            You will not use a virtual private network (&ldquo;VPN&rdquo;), proxy
            server, Tor, or any other privacy or anonymization tool, technique, or technology to circumvent or attempt to
            circumvent any geographic restrictions, access controls, or eligibility requirements imposed by
            {' '}
            {siteName}
            {' '}
            or applicable law. Any attempt to do so constitutes a material breach of these Terms.
          </li>
          <li>
            <strong>Sophistication.</strong>
            {' '}
            You have sufficient knowledge, experience, and understanding of blockchain
            technology, digital assets, smart contracts, and event-based markets to evaluate the risks and merits of any
            transaction you enter into through the Technology Features. You are not relying on
            {' '}
            {siteName}
            {' '}
            for any assessment of whether a particular transaction or strategy is suitable, appropriate, or advisable for
            you.
          </li>
          <li>
            <strong>Applicable Law Compliance.</strong>
            {' '}
            Your access to and use of the Interfaces and Features complies
            with all applicable laws, rules, regulations, orders, and directives in your jurisdiction, including but not
            limited to securities laws, commodities laws, gambling and wagering laws, tax laws, AML/CTF laws, and data
            protection laws.
          </li>
          <li>
            <strong>Financial Risks.</strong>
            {' '}
            You acknowledge and accept that interacting with Contracts involves
            significant financial risk, including the risk of total loss of all digital assets used in connection with
            such Contracts. Prices of digital assets are highly volatile. Past performance is not indicative of future
            results. You should never interact with Contracts using assets that you cannot afford to lose.
          </li>
        </ul>
        <p>
          If any of the foregoing representations or warranties becomes untrue at any time, you must immediately cease
          all access to and use of the Technology Features. Continued use of the Technology Features after any such
          representation becomes untrue constitutes a material breach of these Terms.
        </p>
      </section>

      {/* ── Modifications ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Modifications</h2>
        <p>
          <strong>To the Terms.</strong>
          {' '}
          We reserve the right to modify, amend, supplement, or replace these Terms at any
          time and at our sole discretion. If we make material changes, we will use commercially reasonable efforts to
          provide notice (for example, by posting a notice on the Site, updating the &ldquo;Last updated&rdquo; date
          above, or sending an in-app notification). Your continued access to or use of the Interfaces or Features after
          the effective date of any modification constitutes your acceptance of the modified Terms. If you do not agree to
          the modified Terms, you must immediately stop using the Interfaces and Features.
        </p>
        <p>
          <strong>To the Site and Features.</strong>
          {' '}
          We reserve the right to modify, update, suspend, or discontinue any
          aspect of the Site, Interfaces, or Features (in whole or in part) at any time, with or without notice, and
          without liability to you. This includes, without limitation, adding or removing features, placing Features in a
          close-only or read-only mode, changing supported blockchain networks, modifying available markets, adjusting
          fee structures, and restricting access based on jurisdiction or eligibility criteria.
        </p>
      </section>

      {/* ── Your Responsibilities & Prohibited Conduct ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Your Responsibilities and Prohibited Conduct</h2>
        <p>
          You are solely responsible for your use of the Interfaces and Features and for ensuring that such use complies
          with these Terms and all applicable laws. You agree to use the Interfaces and Features only for lawful purposes
          and in accordance with these Terms. Without limiting the foregoing, you agree that you will not:
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>Violate any applicable law, statute, regulation, ordinance, rule, treaty, or order of any governmental authority.</li>
          <li>Use the Technology Features from a Restricted Jurisdiction or for or on behalf of any restricted person or entity.</li>
          <li>
            Use a VPN, proxy, Tor, or any other privacy or anonymization tool to circumvent or attempt to circumvent any
            geographic restrictions, access controls, or eligibility requirements.
          </li>
          <li>Provide false, inaccurate, misleading, or deceptive information to us or to other users of the Interfaces or Features.</li>
          <li>Create or maintain more than one account or identifier for the purpose of evading restrictions, sanctions, or bans.</li>
          <li>
            Interfere with, disrupt, degrade, impair, or overburden the Interfaces, Features, or any servers, networks,
            or infrastructure connected thereto.
          </li>
          <li>
            Introduce any virus, worm, Trojan horse, ransomware, spyware, adware, or other malicious code or software
            into the Interfaces or Features.
          </li>
          <li>
            Attempt to gain unauthorized access to the Interfaces, Features, or any accounts, systems, or networks
            connected thereto through hacking, password mining, brute force, social engineering, or any other means.
          </li>
          <li>
            Scrape, crawl, spider, harvest, or use any automated tools (including bots, scrapers, or crawlers) to
            extract, collect, or store data from the Interfaces or Features, except as expressly permitted by
            {' '}
            {siteName}
            {' '}
            in writing or through a published API with documented terms.
          </li>
          <li>
            Reverse engineer, decompile, disassemble, decode, or otherwise attempt to derive the source code of any
            software used in connection with the Interfaces or Features, except to the limited extent such activity is
            expressly permitted by applicable law notwithstanding this restriction.
          </li>
          <li>
            Copy, reproduce, distribute, sublicense, lease, lend, sell, resell, or commercially exploit the Interfaces,
            Features, or any content therein, except as expressly permitted under these Terms.
          </li>
          <li>
            Use the Interfaces or Features to engage in, facilitate, or promote any illegal activity, including but not
            limited to fraud, money laundering, terrorist financing, or the violation of any sanctions program.
          </li>
          <li>
            Infringe or misappropriate the intellectual property rights, privacy rights, publicity rights, or other
            proprietary rights of any person or entity.
          </li>
          <li>
            Harass, threaten, intimidate, defame, or abuse any person, including other users of the Interfaces or
            Features, or
            {' '}
            {siteName}
            {' '}
            personnel.
          </li>
          <li>
            Upload, post, transmit, or otherwise make available any content that is unlawful, harmful, threatening,
            abusive, harassing, tortious, defamatory, vulgar, obscene, libelous, invasive of privacy, hateful, or
            otherwise objectionable.
          </li>
        </ul>
        <p>
          <strong>Trading Integrity.</strong>
          {' '}
          Without limiting the generality of the foregoing, you agree that you will
          not engage in any of the following abusive, manipulative, or deceptive trading practices:
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            <strong>Spoofing and Layering:</strong>
            {' '}
            Placing orders with the intent to cancel them before execution in
            order to create a misleading impression of market demand or supply.
          </li>
          <li>
            <strong>Wash Trading:</strong>
            {' '}
            Engaging in transactions where the same beneficial owner is on both sides of
            the trade, or coordinating with others to create the false appearance of trading activity, volume, or
            liquidity.
          </li>
          <li>
            <strong>Front-Running:</strong>
            {' '}
            Using advance knowledge of pending orders or transactions (whether obtained
            through access to non-public information, MEV extraction, or otherwise) to trade ahead of such orders for
            your own benefit.
          </li>
          <li>
            <strong>Cornering and Squeezing:</strong>
            {' '}
            Accumulating a dominant position in a Contract or related asset for
            the purpose of manipulating the price or outcome of that Contract.
          </li>
          <li>
            <strong>Pre-Arranged Trading:</strong>
            {' '}
            Entering into pre-arranged or non-competitive transactions with
            another party outside the ordinary market mechanism.
          </li>
          <li>
            <strong>Market Manipulation:</strong>
            {' '}
            Engaging in any other conduct that is designed to, or has the effect
            of, artificially influencing the price, volume, outcome, or resolution of any Contract, including spreading
            false or misleading information.
          </li>
          <li>
            <strong>Insider Trading:</strong>
            {' '}
            Trading on the basis of material non-public information regarding the
            outcome of events underlying any Contract, or communicating such information to others for the purpose of
            enabling them to trade on it.
          </li>
        </ul>
        <p>
          We may, at our sole discretion, investigate any suspected violation of these Terms and take any action we deem
          appropriate, including but not limited to: issuing warnings; suspending or terminating your access to the
          Interfaces or Features; voiding, reversing, or adjusting transactions; reporting suspicious activity to law
          enforcement or regulatory authorities; and cooperating with investigations by governmental authorities. You
          agree to cooperate with any such investigation.
        </p>
      </section>

      {/* ── Additional Information / Verification ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Additional Information; Verification</h2>
        <p>
          We or our compliance service providers, identity verification vendors, or other agents acting on our behalf may,
          at any time, request additional information or documentation from you to verify your identity, eligibility,
          source of funds, or compliance with these Terms and applicable law. Such requests may include, without
          limitation, government-issued identification documents, proof of address, tax identification numbers, or
          information regarding the source and origin of your digital assets.
        </p>
        <p>
          You agree to provide all requested information promptly and accurately. Failure to provide satisfactory
          information in a timely manner may result in the denial, suspension, or termination of your access to some or
          all Interfaces or Features, including the freezing or restriction of any pending transactions or positions. We
          reserve the right to deny access to any person or entity for any reason or no reason, at our sole discretion.
        </p>
      </section>

      {/* ── Feedback / Content License ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Feedback and Content License</h2>
        <p>
          If you submit, post, upload, or otherwise provide any feedback, suggestions, ideas, comments, bug reports,
          support requests, improvements, or other content to
          {' '}
          {siteName}
          {' '}
          through any channel (including through the Interfaces, email, social media, or community forums)
          (collectively, &ldquo;Feedback&rdquo;), you hereby grant
          {' '}
          {siteName}
          {' '}
          a worldwide, non-exclusive, royalty-free, fully paid-up, transferable, sublicensable (through multiple tiers),
          irrevocable, and perpetual license to use, reproduce, modify, adapt, translate, publish, publicly display,
          publicly perform, distribute, create derivative works from, and otherwise exploit such Feedback in any medium
          and for any purpose, including for the purpose of providing, improving, promoting, and marketing the Interfaces
          and Features.
        </p>
        <p>
          You represent and warrant that: (a) you own or otherwise control all rights necessary to grant the license
          described above; (b) your Feedback does not violate any applicable law or infringe, misappropriate, or violate
          the rights of any third party; and (c) your Feedback does not contain any confidential or proprietary
          information of any third party. You acknowledge that
          {' '}
          {siteName}
          {' '}
          is under no obligation to use, acknowledge, or compensate you for any Feedback.
        </p>
      </section>

      {/* ── Intellectual Property ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Intellectual Property</h2>
        <p>
          <strong>Ownership and License.</strong>
          {' '}
          Except for rights expressly granted to you under these Terms,
          {' '}
          {siteName}
          {' '}
          and its licensors retain all right, title, and interest in and to the Interfaces and Features, including all
          associated intellectual property rights (including patents, copyrights, trademarks, trade secrets, trade dress,
          and moral rights). The
          {' '}
          {siteName}
          {' '}
          name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of
          {' '}
          {siteName}
          {' '}
          or its affiliates or licensors. You may not use such marks without the prior written permission of
          {' '}
          {siteName}
          . Subject to your compliance with these Terms,
          {' '}
          {siteName}
          {' '}
          grants you a personal, revocable, non-exclusive, non-transferable, non-sublicensable, limited license to
          access and use the Interfaces and Features solely as made available to you by
          {' '}
          {siteName}
          {' '}
          and solely for your own personal, non-commercial use (unless otherwise expressly permitted in writing).
        </p>
        <p>
          <strong>Reciprocal License.</strong>
          {' '}
          To the extent that any of your interactions with the Interfaces or
          Features generate data, metadata, transaction records, or other information that is recorded on a public
          blockchain or otherwise made publicly available, you acknowledge that such information is inherently public
          and may be used by
          {' '}
          {siteName}
          {' '}
          and others without restriction. To the extent any such information constitutes your intellectual property,
          you grant
          {' '}
          {siteName}
          {' '}
          a non-exclusive, worldwide, royalty-free, perpetual, irrevocable license to use, reproduce, display, and
          distribute such information in connection with the operation and improvement of the Interfaces and Features.
        </p>
      </section>

      {/* ── Third-Party Services ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Third-Party Services</h2>
        <p>
          The Interfaces and Features may contain links to, integrate with, or otherwise interact with third-party
          websites, applications, services, protocols, smart contracts, oracles, data providers, or content
          (collectively, &ldquo;Third-Party Services&rdquo;). Third-Party Services are not under the control of
          {' '}
          {siteName}
          , and the inclusion of any link to or integration with a Third-Party Service does not imply endorsement,
          approval, or recommendation by
          {' '}
          {siteName}
          .
        </p>
        <p>
          Your use of any Third-Party Service is at your sole risk and is governed by such Third-Party Service&rsquo;s
          own terms of use, privacy policies, and other applicable agreements.
          {' '}
          {siteName}
          {' '}
          is not responsible or liable for the content, accuracy, availability, legality, security, or practices of any
          Third-Party Service, or for any damages, losses, or costs arising from your use of or reliance on any
          Third-Party Service. You should review the terms and privacy policies of any Third-Party Service before using
          it or providing any information to it.
        </p>
      </section>

      {/* ── Indemnification ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Indemnification</h2>
        <p>
          To the fullest extent permitted by applicable law, you agree to defend, indemnify, and hold harmless Axes LLC,
          its parent companies, subsidiaries, affiliates, licensors, service providers, and their respective officers,
          directors, members, managers, employees, contractors, agents, successors, and assigns (collectively, the
          &ldquo;Protected Parties&rdquo;) from and against any and all claims, demands, suits, actions, investigations,
          proceedings, damages, settlements, losses, liabilities, deficiencies, costs, and expenses (including but not
          limited to reasonable attorneys&rsquo; fees, expert witness fees, court costs, and costs of investigation and
          litigation) (collectively, &ldquo;Losses&rdquo;) arising out of or relating to:
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>Your access to, use of, or inability to use the Interfaces or Features.</li>
          <li>Your violation of these Terms or any representation, warranty, or covenant contained herein.</li>
          <li>Your violation of any applicable law, regulation, or order.</li>
          <li>Your Feedback or any content you submit, post, or transmit through the Interfaces.</li>
          <li>Your infringement or misappropriation of any third-party intellectual property, privacy, publicity, or other proprietary right.</li>
          <li>Any dispute or claim between you and any third party, including other users of the Interfaces or Features.</li>
          <li>Your negligence, willful misconduct, or fraud.</li>
        </ul>
        <p>
          If any Protected Party receives a subpoena, civil investigative demand, or other compulsory process in
          connection with any of the foregoing, you will reimburse the Protected Party for all reasonable time, materials,
          and legal expenses incurred in responding to such process. We reserve the right, at your expense, to assume the
          exclusive defense and control of any matter for which you are required to indemnify us, and you agree to
          cooperate with our defense of such claims.
        </p>
      </section>

      {/* ── Disclaimers ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Disclaimers</h2>
        <p className="font-medium">
          THE INTERFACES AND FEATURES ARE PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS,
          WITHOUT ANY REPRESENTATIONS OR WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, OR STATUTORY. TO THE MAXIMUM
          EXTENT PERMITTED BY APPLICABLE LAW,
          {' '}
          {siteNameUpper}
          {' '}
          AND ITS LICENSORS, SERVICE PROVIDERS, AND AFFILIATES EXPRESSLY DISCLAIM ALL WARRANTIES AND CONDITIONS, WHETHER
          EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES AND CONDITIONS OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, QUIET
          ENJOYMENT, INTEGRATION, AND ANY WARRANTIES OR CONDITIONS ARISING FROM COURSE OF DEALING, COURSE OF
          PERFORMANCE, OR USAGE OF TRADE.
        </p>
        <p className="font-medium">
          WITHOUT LIMITING THE FOREGOING,
          {' '}
          {siteNameUpper}
          {' '}
          MAKES NO WARRANTY OR REPRESENTATION THAT: (A) THE INTERFACES OR FEATURES WILL MEET YOUR REQUIREMENTS OR
          EXPECTATIONS; (B) THE INTERFACES OR FEATURES WILL BE AVAILABLE ON AN UNINTERRUPTED, TIMELY, SECURE, OR
          ERROR-FREE BASIS; (C) ANY CONTENT, DATA, OR INFORMATION OBTAINED THROUGH THE INTERFACES OR FEATURES WILL BE
          ACCURATE, RELIABLE, COMPLETE, OR CURRENT; (D) ANY DEFECTS OR ERRORS IN THE INTERFACES OR FEATURES WILL BE
          CORRECTED; (E) THE INTERFACES OR FEATURES WILL BE FREE OF VIRUSES, MALWARE, OR OTHER HARMFUL COMPONENTS; OR
          (F) ANY TRANSACTION EXECUTED THROUGH THE TECHNOLOGY FEATURES WILL BE COMPLETED SUCCESSFULLY, TIMELY, OR AT
          THE DISPLAYED PRICE.
        </p>
        <p className="font-medium">
          YOU ACKNOWLEDGE THAT YOUR USE OF THE INTERFACES AND FEATURES IS AT YOUR SOLE RISK. NO ADVICE OR INFORMATION,
          WHETHER ORAL OR WRITTEN, OBTAINED FROM
          {' '}
          {siteNameUpper}
          {' '}
          OR THROUGH THE INTERFACES OR FEATURES SHALL CREATE ANY WARRANTY OR REPRESENTATION NOT EXPRESSLY MADE HEREIN.
        </p>
      </section>

      {/* ── Limitation of Liability ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Limitation of Liability</h2>
        <p className="font-medium">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
          {' '}
          {siteNameUpper}
          , ITS PARENT COMPANIES, SUBSIDIARIES, AFFILIATES, LICENSORS, SERVICE PROVIDERS, OR ANY OF THEIR RESPECTIVE
          OFFICERS, DIRECTORS, MEMBERS, MANAGERS, EMPLOYEES, CONTRACTORS, AGENTS, SUCCESSORS, OR ASSIGNS (COLLECTIVELY,
          THE &ldquo;
          {siteNameUpper}
          {' '}
          PARTIES&rdquo;) BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, REVENUE, GOODWILL,
          BUSINESS OPPORTUNITIES, DATA, USE, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR ACCESS TO
          OR USE OF (OR INABILITY TO ACCESS OR USE) THE INTERFACES OR FEATURES, WHETHER BASED ON WARRANTY, CONTRACT,
          TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, STATUTE, OR ANY OTHER LEGAL THEORY, EVEN IF ANY
          {' '}
          {siteNameUpper}
          {' '}
          PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p className="font-medium">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE AGGREGATE LIABILITY OF THE
          {' '}
          {siteNameUpper}
          {' '}
          PARTIES FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE INTERFACES OR FEATURES
          SHALL NOT EXCEED ONE HUNDRED U.S. DOLLARS (USD $100). THIS LIMITATION APPLIES TO ALL CAUSES OF ACTION IN THE
          AGGREGATE, INCLUDING BUT NOT LIMITED TO BREACH OF CONTRACT, BREACH OF WARRANTY, NEGLIGENCE, STRICT LIABILITY,
          TORT, AND ANY OTHER LEGAL OR EQUITABLE CLAIMS.
        </p>
        <p>
          The limitations of liability set forth in this section are fundamental elements of the basis of the bargain
          between you and
          {' '}
          {siteName}
          . Some jurisdictions do not allow the exclusion or limitation of incidental or consequential damages; in such
          jurisdictions, the above limitations and exclusions shall apply to the fullest extent permitted by applicable
          law.
        </p>
      </section>

      {/* ── Governing Law and Dispute Resolution ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Governing Law and Dispute Resolution</h2>
        <p>
          <strong>Governing Law.</strong>
          {' '}
          These Terms and any dispute, claim, or controversy arising out of, relating to,
          or in connection with these Terms or the Interfaces or Features (whether in contract, tort, statute, or
          otherwise) shall be governed by and construed in accordance with the laws of Saint Vincent and the Grenadines,
          without regard to its conflict-of-laws principles or rules.
        </p>
        <p>
          <strong>Informal Dispute Resolution.</strong>
          {' '}
          Before initiating any arbitration or legal proceeding, the
          aggrieved party must first send a written notice to the other party describing the nature and basis of the
          claim or dispute and the specific relief sought (&ldquo;Dispute Notice&rdquo;). A Dispute Notice to
          {' '}
          {siteName}
          {' '}
          must be sent by email to hello@axes.co. Upon receipt of a Dispute Notice, the parties shall attempt in good
          faith to resolve the dispute through informal negotiation within sixty (60) business days from the date the
          Dispute Notice is received. During this period, each party agrees to make its representatives reasonably
          available for discussions.
        </p>
        <p>
          <strong>Binding Arbitration.</strong>
          {' '}
          If the dispute is not resolved through informal negotiation within the
          sixty (60) business day period described above, either party may initiate binding arbitration. Any dispute,
          claim, or controversy that is not resolved through informal negotiation shall be exclusively and finally
          resolved by binding arbitration administered by a reputable arbitration institution in Saint Vincent and the
          Grenadines, under its rules in effect at the time the claim is filed. The arbitration shall be conducted before
          a single arbitrator, in the English language, and the seat of arbitration shall be Saint Vincent and the
          Grenadines. The arbitrator shall have the authority to grant any remedy or relief that would be available in a
          court of competent jurisdiction, provided that the arbitrator shall not have the authority to conduct any form
          of class, collective, or representative arbitration. The arbitrator&rsquo;s award shall be final and binding
          and may be entered and enforced in any court of competent jurisdiction. Either party may seek provisional or
          interim relief from a court of competent jurisdiction as necessary to protect the rights or property of that
          party pending the appointment of the arbitrator or the arbitrator&rsquo;s determination of the merits of the
          controversy. You and Axes LLC each waive any right to a jury trial.
        </p>
        <p>
          <strong>Class Action Waiver.</strong>
          {' '}
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, YOU AND
          {' '}
          {siteNameUpper}
          {' '}
          EACH AGREE THAT ANY PROCEEDINGS TO RESOLVE DISPUTES WILL BE CONDUCTED SOLELY ON AN INDIVIDUAL BASIS AND NOT IN
          A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE
          PERSON&rsquo;S CLAIMS AND MAY NOT OTHERWISE PRESIDE OVER ANY FORM OF CLASS, COLLECTIVE, CONSOLIDATED, OR
          REPRESENTATIVE PROCEEDING. IF A COURT OF COMPETENT JURISDICTION DETERMINES THAT THIS CLASS ACTION WAIVER IS
          UNENFORCEABLE, THEN THE ENTIRETY OF THE ARBITRATION AGREEMENT IN THIS SECTION SHALL BE NULL AND VOID, AND THE
          DISPUTE SHALL PROCEED IN A COURT OF COMPETENT JURISDICTION IN SAINT VINCENT AND THE GRENADINES.
        </p>
        <p>
          <strong>Opt-Out.</strong>
          {' '}
          You have the right to opt out of the binding arbitration and class action waiver
          provisions of this section by sending written notice of your decision to opt out to hello@axes.co within
          thirty (30) days after first becoming subject to these Terms. Your notice must include your name, your Wallet
          address (if applicable), and a clear statement that you wish to opt out of the arbitration and class action
          waiver provisions. If you opt out, neither you nor
          {' '}
          {siteName}
          {' '}
          will be required to arbitrate disputes, and all disputes shall be resolved in a court of competent jurisdiction
          in Saint Vincent and the Grenadines. All other provisions of these Terms will continue to apply.
        </p>
      </section>

      {/* ── Taxes ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Taxes</h2>
        <p>
          You are solely responsible for determining, calculating, reporting, and paying any and all taxes, duties,
          levies, or assessments that may arise from your use of the Interfaces or Features, including but not limited to
          income taxes, capital gains taxes, value-added taxes, goods and services taxes, withholding taxes, and any other
          taxes imposed by any governmental authority (collectively, &ldquo;Taxes&rdquo;).
          {' '}
          {siteName}
          {' '}
          does not provide tax advice and makes no representations regarding the tax consequences of your use of the
          Interfaces or Features. You should consult with a qualified tax professional regarding your specific tax
          obligations. You agree to indemnify and hold harmless the Protected Parties from and against any Taxes or
          penalties imposed on or asserted against
          {' '}
          {siteName}
          {' '}
          as a result of your failure to comply with your tax obligations.
        </p>
      </section>

      {/* ── Termination ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Termination</h2>
        <p>
          We may, at our sole discretion and without prior notice, suspend, restrict, or terminate your access to some or
          all of the Interfaces or Features at any time and for any reason, including but not limited to: (a) a suspected
          or actual violation of these Terms; (b) a suspected or actual violation of any applicable law, regulation, or
          order; (c) a request by law enforcement or a governmental authority; (d) unexpected technical or security
          issues; or (e) extended periods of inactivity.
        </p>
        <p>
          Upon termination: (i) your right to access and use the Interfaces and Features ceases immediately; (ii) you
          remain responsible for all obligations accrued prior to termination; and (iii) all provisions of these Terms
          which by their nature should survive termination shall survive, including but not limited to: Intellectual
          Property, Feedback and Content License, Indemnification, Disclaimers, Limitation of Liability, Governing Law
          and Dispute Resolution, Taxes, and General Terms.
        </p>
        <p>
          You may terminate your relationship with
          {' '}
          {siteName}
          {' '}
          at any time by discontinuing your use of the Interfaces and Features and disconnecting your Wallet. Please note
          that any transactions that have already been broadcast to the blockchain cannot be reversed, cancelled, or
          modified by
          {' '}
          {siteName}
          , and you remain responsible for such transactions and their consequences.
        </p>
      </section>

      {/* ── General Terms ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">General Terms</h2>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            <strong>Entire Agreement.</strong>
            {' '}
            These Terms, together with the Privacy Policy and any other documents
            expressly incorporated by reference herein, constitute the entire agreement between you and
            {' '}
            {siteName}
            {' '}
            with respect to the subject matter hereof and supersede all prior and contemporaneous understandings,
            agreements, representations, and warranties, both written and oral, with respect to such subject matter.
          </li>
          <li>
            <strong>No Agency or Relationship.</strong>
            {' '}
            Nothing in these Terms shall be construed to create any
            partnership, joint venture, employment, franchise, or agency relationship between you and
            {' '}
            {siteName}
            . Neither party has the authority to bind the other or to incur any obligation on behalf of the other.
            You acknowledge that
            {' '}
            {siteName}
            {' '}
            does not act as your broker, intermediary, agent, fiduciary, or adviser in any capacity.
          </li>
          <li>
            <strong>Assignment.</strong>
            {' '}
            You may not assign, delegate, or transfer these Terms or any of your rights or
            obligations hereunder, in whole or in part, by operation of law or otherwise, without the prior written
            consent of
            {' '}
            {siteName}
            . Any purported assignment without such consent shall be null and void. We may freely assign, delegate, or
            transfer these Terms and our rights and obligations hereunder without restriction and without notice to you.
          </li>
          <li>
            <strong>Severability.</strong>
            {' '}
            If any provision of these Terms is held by a court or arbitrator of competent
            jurisdiction to be invalid, illegal, or unenforceable for any reason, such provision shall be modified to
            the minimum extent necessary to make it valid, legal, and enforceable, and the remaining provisions of these
            Terms shall continue in full force and effect.
          </li>
          <li>
            <strong>Waiver.</strong>
            {' '}
            The failure of
            {' '}
            {siteName}
            {' '}
            to exercise or enforce any right or provision of these Terms shall not constitute a waiver of such right or
            provision. A waiver of any right or provision shall be effective only if it is in writing and signed by a duly
            authorized representative of
            {' '}
            {siteName}
            . No waiver of any right or provision shall be deemed a further or continuing waiver of such right or
            provision or of any other right or provision.
          </li>
          <li>
            <strong>Remedies.</strong>
            {' '}
            The rights and remedies of
            {' '}
            {siteName}
            {' '}
            under these Terms are cumulative and are in addition to, and not in substitution for, any other rights and
            remedies available at law, in equity, or otherwise.
          </li>
          <li>
            <strong>Notices.</strong>
            {' '}
            All notices, requests, and communications from you to
            {' '}
            {siteName}
            {' '}
            under these Terms shall be sent by email to hello@axes.co. Notices from
            {' '}
            {siteName}
            {' '}
            to you may be provided by posting on the Site, sending an in-app notification, or sending to any email
            address associated with your account or Wallet.
          </li>
          <li>
            <strong>Force Majeure.</strong>
            {' '}
            {siteName}
            {' '}
            shall not be liable for any delay or failure to perform any obligation under these Terms if such delay or
            failure results from circumstances beyond its reasonable control, including but not limited to acts of God,
            natural disasters, epidemics, pandemics, war, terrorism, riots, embargoes, acts of governmental authorities,
            power failures, internet or telecommunications failures, cyberattacks, blockchain network failures or
            congestion, or other force majeure events.
          </li>
          <li>
            <strong>Contact.</strong>
            {' '}
            If you have any questions, complaints, or claims regarding the Interfaces or
            Features, or if you wish to provide a Dispute Notice, please contact us at hello@axes.co.
          </li>
        </ul>
      </section>
    </main>
  )
}
