# Tableau de bord

Le tableau de bord résume une campagne (ou toutes, selon la campagne choisie dans l'en-tête).
Cette page explique ce que compte chaque chiffre et chaque bloc.

Vocabulaire :

- **Piste active** : piste dont l'étape n'est ni « gagnée » ni « perdue » (nature d'étape
  `WON` / `LOST`, réglée dans les paramètres). « Refusé », « Sans suite » et « Abandonné » sont
  des étapes perdues : une piste à l'une de ces étapes est inactive (voir
  [Clore une piste](#clore-une-piste-refusé-sans-suite-ou-abandonné)).
- **Contact** : un échange noté dans le journal d'une piste, **ou** un entretien qui a eu lieu
  (daté et dont le statut n'est plus « à venir »).
- **Réponse** : un contact où l'autre partie a répondu. Un échange coché **« Sans réponse »**
  (message laissé sur répondeur, mail resté sans retour) est une **relance faite**, pas une
  réponse. Un entretien qui a eu lieu est toujours une réponse.
- **Action** : tâche d'une piste (« Rappeler », « Envoyer le CV »…), avec une échéance facultative.
- **Entretien** : tour du « Processus de recrutement » d'une piste (échange client, entretien RH,
  technique, test…).

## Chiffres clés

Chaque chiffre a une explication au survol. Un clic mène au bloc correspondant (ou à la liste
des pistes pour « actives »).

| Chiffre | Ce qu'il compte | Clic |
| --- | --- | --- |
| **actives sur N** | Pistes actives, sur le nombre total de pistes. | Liste des pistes |
| **en retard** | Actions non faites dont l'échéance est **dépassée**, sur les pistes actives. | Bloc « À faire » |
| **aujourd'hui** | Actions non faites dont l'échéance est **aujourd'hui**, sur les pistes actives. | Bloc « À faire » |
| **à relancer** | Pistes à relancer (voir [Relances](#relances)). Les pistes sans réponse au-delà du délai annoncé sont dans un bloc à part, « Sans réponse ». | Bloc « À relancer » |
| **entretiens en cours** | Entretiens pas encore tranchés : à venir, à planifier ou en attente du retour (voir [Entretiens en cours](#entretiens-en-cours)). | Bloc « Entretiens en cours » |
| **échanges 7 j** | Échanges du journal et entretiens passés au cours des 7 derniers jours. | — |

« en retard » et « aujourd'hui » ne concernent que les **actions** : un entretien ou une piste
sans action n'y apparaît jamais. Une action sans échéance n'est comptée nulle part.

## Blocs

### Entretiens en cours

Liste les entretiens des pistes actives qui attendent encore une issue, en trois groupes :

| Groupe | Statut de l'entretien | Date |
| --- | --- | --- |
| **À venir** | « À venir / à planifier » | renseignée |
| **En attente du retour** | « Passé, en attente du retour » | — |
| **À planifier** | « À venir / à planifier » | vide |

Un entretien « à venir » dont la date est passée reste dans « À venir » avec la mention
**Date passée** : c'est un rappel pour mettre son statut à jour (« Effectué », puis
« Validé » ou « Non retenu »). Sur la fiche, le raccourci « Effectué » n'apparaît qu'à partir
du jour de l'entretien : avant, il n'y a rien à mettre à jour.

N'apparaissent **pas** :

- les entretiens **validés** ou **non retenus** (ils sont tranchés) ;
- les entretiens des pistes gagnées ou perdues ;
- les entretiens notés seulement dans le journal des échanges, ou signalés seulement par l'étape
  du pipeline. Pour qu'un entretien soit suivi ici, il faut l'ajouter dans « Processus de
  recrutement » sur la fiche de la piste (voir [Entretiens](entretiens.md)).

« Aucun entretien en cours » signifie donc qu'aucune piste active n'a d'entretien en attente
d'une issue.

### À faire

Actions non faites des pistes actives dont l'échéance est dépassée, aujourd'hui ou dans les
7 prochains jours, de la plus ancienne à la plus lointaine. Le bouton ✓ marque l'action comme
faite.

### À relancer

Pistes à relancer, la plus ancienne d'abord, avec le nombre de jours depuis le dernier contact.
Voir [Relances](#relances).

### Pistes par étape

Nombre de pistes à chaque étape du pipeline, dans l'ordre des paramètres. Les étapes clôturées
(gagnée, perdue) sont en gris. Une piste passe d'elle-même à l'étape des entretiens à son
premier entretien (voir [Entretiens](entretiens.md#étape-de-la-piste)).

### Derniers échanges

Les 8 derniers échanges du journal, toutes pistes confondues (actives ou non).

## Relances

« À relancer » est un **calcul automatique**, pas une étape du pipeline : une piste qui attend
une relance reste à son étape (« Dossier envoyé », par exemple).

### Date de relance

Chaque piste active a une **date de relance**, affichée sur sa fiche (« Relance le … ») et dans
le formulaire de la piste :

- par défaut, elle est **calculée** : dernier contact + **délai de relance** (14 jours par
  défaut). Une piste jamais contactée n'a pas de date calculée ;
- elle peut être **fixée** sur la piste (champ « Relance prévue le » du formulaire, ou bouton
  « Reporter » / « Changer »), plus tôt ou plus tard que le calcul, dès la création de la piste.
  Par exemple, quand le recruteur annonce un retour « fin de semaine prochaine ».

Une date fixée vaut jusqu'au **prochain contact** : un échange (même sans réponse : la
relance prévue a été faite) ou un entretien daté après le jour où elle a été saisie la rend
caduque, et la relance redevient calculée. Un échange du même jour ne l'annule pas : on peut
noter la candidature et fixer la relance ensemble.

Une relance restée sans réponse repousse donc la suivante du délai de relance, comme
n'importe quel contact : inutile de relancer de nouveau le lendemain.

La piste est **à relancer** quand sa date de relance est atteinte, sauf si :

- un entretien est **prévu** (statut « à venir », daté d'aujourd'hui ou plus tard) : la suite
  est déjà calée. Une fois la date passée, si l'entretien est noté comme ayant eu lieu, il
  compte comme un contact ; s'il reste « à venir », il ne suspend plus la relance ;
- une **réponse est attendue** (voir [Délai de réponse](#délai-de-réponse)) ;
- la piste est **sans réponse** depuis trop longtemps (voir
  [Silence prolongé](#silence-prolongé)).

Elle apparaît alors dans le chiffre et le bloc « À relancer », dans les notifications et, dans
la liste des pistes comme sur la fiche, avec une icône d'alerte à côté du dernier contact.

### Délai de relance

Réglable dans **Paramètres → Relances**, de 1 à 90 jours (14 par défaut). Il est propre à
chaque utilisateur et s'applique à toutes ses campagnes, pour les pistes sans date de relance
fixée, qu'il s'agisse d'une première relance ou d'une relance après une relance sans réponse.

### Délai de réponse

Quand le recruteur annonce un délai (« sans retour sous 4 semaines, considérez que votre
candidature n'est pas retenue »), le noter dans le champ **« Sans réponse le, non retenue »** du
formulaire de la piste. Les boutons 2, 3, 4 et 6 semaines remplissent la date à partir
d'aujourd'hui.

- Jusqu'à cette date, la piste **n'est pas à relancer** : la fiche affiche « Réponse attendue
  d'ici le … ». Une date de relance fixée **avant** l'échéance reste valable.
- À partir de cette date, sans réponse, la piste passe dans le bloc **« Sans réponse »** du
  tableau de bord (affiché seulement s'il n'est pas vide), avec une notification. **Clore…**
  propose de la passer à une étape perdue (« Sans suite » présélectionnée) ; rien n'est fait
  d'office. **Toujours en attente** repousse l'échéance, ou la retire pour revenir aux
  relances habituelles.

Le délai tombe dès qu'une **réponse** arrive après sa saisie : la suite se gère normalement.
Une relance restée sans réponse, elle, ne l'annule pas.

### Silence prolongé

Souvent, aucune réponse n'arrive malgré les relances (en particulier quand l'intermédiaire
n'obtient lui-même rien du client). Quand une piste n'a eu **aucune réponse depuis le délai de
silence** (30 jours par défaut) et qu'au moins une relance sans réponse a été faite depuis, elle
passe aussi dans le bloc **« Sans réponse »**, avec une notification. Le silence se compte
depuis la dernière réponse, ou depuis le premier contact si personne n'a jamais répondu.

Une piste qu'on n'a jamais relancée n'y passe pas : elle reste « à relancer ». **Clore…**
présélectionne « Sans suite » ; **Toujours en attente** fixe une date de relance (la piste
revient dans « Sans réponse » à cette date si rien n'a bougé). Une réponse la fait sortir du
bloc.

Le délai de silence se règle dans **Paramètres → Relances**, de 7 à 180 jours.

### Clore une piste : refusé, sans suite ou abandonné

Trois étapes perdues par défaut, pour trois issues différentes ; toutes rendent la piste
inactive :

| Étape | Qui décide | Exemple |
| --- | --- | --- |
| **Refusé** | L'autre partie, explicitement | « Profil non retenu », entretien non retenu |
| **Sans suite** | Personne : pas de réponse | Le cabinet n'a jamais eu de retour du client |
| **Abandonné** | Moi | Poste peu intéressant, autre offre acceptée |

La clôture proposée après un entretien non retenu présélectionne « Refusé » ; celle du bloc
« Sans réponse », « Sans suite ». Les étapes se renomment dans les paramètres (la
présélection se fait par libellé : renommée, l'étape n'est plus présélectionnée et la première
étape perdue est proposée).

### Noter une relance

Le bouton **Noter une relance** d'une ligne du bloc « À relancer » **n'envoie rien** : il sert à
enregistrer une relance faite par ailleurs (mail, appel, LinkedIn…). Il ouvre la saisie d'un
échange du journal (date du jour, résumé « Relance » à compléter, canal et interlocuteur
facultatifs), avec **« Sans réponse » coché** : à décocher si l'interlocuteur a répondu.
Une fois enregistrée, la relance compte comme un contact : la piste sort de la liste
jusqu'à sa prochaine date de relance (calculée à partir de ce contact).

Une relance notée directement dans le journal de la fiche a le même effet.

### Reporter

**Reporter** (3 jours, 1 semaine, 2 semaines ou 1 mois) fixe la date de relance à partir
d'aujourd'hui, sans noter d'échange : la piste sort de « À relancer » jusque-là. Ce bouton est
sur le bloc « À relancer » et sur la fiche (« Changer » quand la relance n'est pas encore due).
Pour une date fixée, le menu propose aussi de revenir au délai de relance.

## Notifications

La cloche reprend les mêmes règles, mais seulement pour les campagnes **en cours** (une
campagne clôturée ne génère plus d'alerte) :

- action en retard, prévue aujourd'hui ou dans les 7 jours ;
- piste à relancer (date de relance atteinte) ;
- piste sans réponse : délai annoncé dépassé, ou silence prolongé malgré les relances.
