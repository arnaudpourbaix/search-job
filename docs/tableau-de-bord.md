# Tableau de bord

Le tableau de bord résume une campagne (ou toutes, selon la campagne choisie dans l'en-tête).
Cette page explique ce que compte chaque chiffre et chaque bloc.

Vocabulaire :

- **Piste active** : piste dont l'étape n'est ni « gagnée » ni « perdue » (nature d'étape
  `WON` / `LOST`, réglée dans les paramètres).
- **Contact** : un échange noté dans le journal d'une piste, **ou** un entretien qui a eu lieu
  (daté et dont le statut n'est plus « à venir »).
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
| **à relancer** | Pistes à relancer (voir [Relances](#relances)). | Bloc « À relancer » |
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
une relance reste à son étape (« Dossier envoyé », par exemple). Une piste est à relancer quand :

1. elle est active ;
2. elle a déjà eu au moins un contact : une piste jamais contactée n'est pas à relancer ;
3. son dernier contact date de plus que le **délai de relance** (14 jours par défaut) ;
4. sa relance n'est pas **reportée**.

Elle apparaît alors dans le chiffre et le bloc « À relancer », dans les notifications et, dans
la liste des pistes comme sur la fiche, avec une icône d'alerte à côté du dernier contact.

### Délai de relance

Réglable dans **Paramètres → Relances**, de 1 à 90 jours. Il est propre à chaque utilisateur
et s'applique à toutes ses campagnes.

### Relancer

Le bouton **Relancer** d'une ligne du bloc « À relancer » ouvre la saisie d'un échange
(date du jour, résumé « Relance » à compléter, canal et interlocuteur facultatifs).
Une fois enregistrée, la relance compte comme un contact : la piste sort de la liste
jusqu'à ce que le délai soit de nouveau dépassé.

Une relance notée directement dans le journal de la fiche a le même effet.

### Reporter

**Reporter** (3 jours, 1 semaine, 2 semaines ou 1 mois) sort la piste de « À relancer » sans
noter d'échange, par exemple quand on attend volontairement un retour. Ce bouton est sur le
bloc « À relancer » et, pour une piste à relancer, sur sa fiche.

Pendant le report, la fiche affiche « Relance reportée au … » ; la croix annule le report.
À la date choisie, la piste redevient à relancer si elle l'est toujours.

## Notifications

La cloche reprend les mêmes règles, mais seulement pour les campagnes **en cours** (une
campagne clôturée ne génère plus d'alerte) :

- action en retard, prévue aujourd'hui ou dans les 7 jours ;
- piste à relancer (délai et report compris).
