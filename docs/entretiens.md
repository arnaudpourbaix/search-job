# Entretiens

Chaque piste a un **processus de recrutement** : la suite de ses entretiens (échange client,
entretien RH, technique, test…), dans l'ordre où ils se succèdent. On le gère dans la carte
« Processus de recrutement » de la fiche d'une piste.

## Statuts d'un entretien

| Statut | Affiché | Signification |
| --- | --- | --- |
| À venir / à planifier | **À planifier** (sans date), **À venir** (date à venir), **Date passée** (date passée) | L'entretien n'a pas encore eu lieu |
| Passé, en attente du retour | **En attente du retour** | L'entretien a eu lieu, on attend la réponse |
| Validé | **Validé** | Réponse positive : on passe à l'entretien suivant |
| Non retenu | **Non retenu** | Réponse négative |

« Date passée » est un rappel : l'entretien est toujours noté « à venir » alors que sa date est
dépassée, il faut mettre son statut à jour.

Un entretien qui a eu lieu (daté et plus « à venir ») compte comme un **contact** de la piste,
au même titre qu'un échange du journal : il remet à zéro le compteur de relance.

## Frise

Chaque entretien est une pastille sur la frise, à la couleur et à l'icône de son statut (gris :
à planifier, bleu : à venir, orange : date passée, jaune : en attente du retour, vert : validé,
rouge : non retenu). Le trait entre deux pastilles est plein après un entretien validé, en
pointillés sinon. Les pastilles ne sont pas cliquables.

## Changer le statut

### Raccourcis de l'entretien en cours

L'**entretien en cours** est le premier de la frise qui n'est ni validé ni non retenu. Il
affiche le raccourci qui le fait avancer d'un cran :

| Situation | Bouton | Effet |
| --- | --- | --- |
| Pas de date | **Planifier** | Ouvre le formulaire pour saisir la date et l'heure |
| Date à venir | *(aucun)* | Rien à faire avant le jour de l'entretien |
| Le jour même ou après | **Effectué** | Statut « Passé, en attente du retour » |
| En attente du retour | **Validé** / **Non retenu** | Statut correspondant |

Le cycle complet : **Planifier → Effectué → Validé ou Non retenu**.

### Menu de statut

Le badge à flèche, à droite du titre de chaque entretien, ouvre un menu pour choisir
n'importe quel statut, y compris pour revenir en arrière après une erreur. Le formulaire de
modification (menu « … » → Modifier) permet aussi de changer le statut.

## Étape de la piste

Le processus détaille une piste ; l'**étape** la situe dans le pipeline (colonnes, graphique
« Pistes par étape », filtres). Les deux sont liés :

- **Premier entretien** : dès qu'un entretien est ajouté, même sans date, la piste passe d'elle-même
  à la **première étape de nature « Avancée »** du pipeline (par défaut « Entretiens »). Un
  message l'indique. La piste ne recule jamais : si elle est déjà à une étape avancée (une
  proposition, par exemple), ou gagnée ou perdue, son étape ne change pas.
- **Entretien non retenu** : l'application **propose** de clore la piste sur une étape de
  nature « Perdue » (« Refusé », « Abandonné »…), au choix. Rien n'est fait d'office : on peut
  garder la piste ouverte, par exemple si un autre poste reste possible chez le même client.
  La proposition n'apparaît pas si la piste est déjà gagnée ou perdue.

Les étapes et leur nature se règlent dans **Paramètres → Étapes**. Pour un compte créé avant
ce fonctionnement, l'étape s'appelle « Entretien client » ; on peut la renommer
« Entretiens », puisque le processus couvre aussi les entretiens RH, techniques et les tests.

## Tableau de bord

Le bloc et le chiffre « Entretiens en cours » reprennent les entretiens non tranchés des pistes
actives : voir [Tableau de bord](tableau-de-bord.md#entretiens-en-cours).
