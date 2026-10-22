# LaPompe : la fiche des boutiques (français)

Ce qu'on colle dans le formulaire de chaque boutique. Les limites sont celles des boutiques.

## Nom

LaPompe

## Résumé (Firefox : 250 caractères au plus ; Chrome prend la description du manifeste, 132 au plus)

Envoie votre connexion YouTube à votre propre serveur TonTuyau, pour qu'il lise YouTube en votre nom, et ajoute des
boutons « Ajouter à TonTuyau » sur les pages de vidéo et de chaîne de YouTube.

## Description

LaPompe est l'extension de navigateur de TonTuyau, une application à la YouTube que vous hébergez vous-même sur votre
vidéothèque (https://github.com/TonTuyau/TonTuyau). LaPompe remplit TonTuyau.

Ce qu'elle fait :

- Envoie vos cookies de youtube.com à votre TonTuyau toutes les quelques minutes (30 par défaut, à votre choix) et quand
  vous cliquez sur « Envoyer le cookie maintenant ». TonTuyau lit alors YouTube connecté en votre nom, ce qui évite la
  plupart des vérifications anti-robot et lui permet de lire les vidéos que votre compte peut voir. YouTube renouvelle
  ses cookies pendant que vous naviguez : les envoyer souvent garde la copie de TonTuyau valable.
- Montre, dans sa fenêtre, ce que votre TonTuyau a répondu : si YouTube a accepté le cookie, quand il a été envoyé,
  quand il part ensuite.
- Ajoute « Ajouter à TonTuyau » à côté de S'abonner sur les pages de vidéo et de chaîne de YouTube : un clic, et votre
  TonTuyau télécharge la vidéo, ou s'abonne à la chaîne. Il dit quand votre TonTuyau l'a déjà (« Dans TonTuyau ») ou la
  télécharge (« En attente dans TonTuyau »). Il faut TonTuyau 2.0 ou plus, la version qui télécharge.

Ce qu'il faut : un serveur TonTuyau (1.5 ou plus) et une clé d'API de type « Extension de navigateur » créée dedans.

Vie privée : LaPompe envoie vos cookies de youtube.com, et les identifiants des vidéos et chaînes YouTube que vous ouvrez
(pour son bouton), seulement à l'adresse de TonTuyau que vous réglez. Aucun autre site, aucun pistage, aucun serveur à
elle. Son code est ouvert (GPL-3.0-or-later) : https://github.com/TonTuyau/LaPompe

## Catégorie

- Firefox : Gestion des téléchargements (sinon : Autre)
- Chrome : Outils

## Assistance

- Site et assistance : https://github.com/TonTuyau/LaPompe
- Politique de confidentialité : https://github.com/TonTuyau/LaPompe/blob/main/PRIVACY.md
- Licence : GPL-3.0-or-later

Les réponses aux questions de Chrome (usage unique, justification des permissions, code distant, données) et de
Firefox (collecte de données, code source) se donnent en anglais : voir `listing.en.md`.
