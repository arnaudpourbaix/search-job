# Pistes

## Lieu et itinéraire

Sur la fiche d'une piste, le **lieu** est un lien vers Google Maps. À côté, **Itinéraire**
ouvre Google Maps sur le trajet en transports en commun (train, métro, bus) depuis l'**adresse
de départ** réglée dans **Paramètres → Itinéraires** (le domicile, par exemple). Sans adresse
de départ, Google Maps part de la position actuelle ou la demande.

Les liens s'ouvrent dans un nouvel onglet. L'application n'appelle aucun service de
cartographie : l'adresse n'est transmise à Google qu'au clic. Le lieu peut être prérempli avec
l'adresse de l'entreprise (voir [Entreprises](entreprises.md#adresse-et-lieu-dune-piste)).

## Échanges et historique

La carte « Échanges et historique » de la fiche d'une piste regroupe, du plus récent au plus
ancien :

| Entrée | Origine | Compte comme contact |
| --- | --- | --- |
| **Échange** | Saisi à la main (« Ajouter un échange », ou « Noter une relance » depuis le tableau de bord). Coché « Sans réponse », il est marqué comme tel : relance faite, pas réponse | Oui |
| **Entretien** | Ajouté d'office quand un entretien du processus a eu lieu (daté et plus « à venir ») | Oui |
| **Étape** | Ajouté d'office à chaque changement d'étape | **Non** |

Un contact repousse la relance (voir [Tableau de bord](tableau-de-bord.md#relances)) et rend
caduque la date de relance saisie avant lui ; seule une réponse annule le délai de réponse ; un changement d'étape,
non : changer d'étape sans avoir parlé à personne ne fait pas sortir une piste de « À relancer ».

À date égale, l'ordre est : étape, entretien, échange.

### Changements d'étape

Sont tracés :

- la **création** de la piste (« Piste créée à l'étape … ») ;
- chaque changement fait **à la main** : menu d'étape de la fiche, formulaire de la piste,
  glisser-déposer dans le pipeline, clôture proposée après un entretien « non retenu » ou une
  candidature restée sans réponse ;
- les changements faits **par l'application**, marqués « automatique » : passage à l'étape des
  entretiens au premier entretien (voir [Entretiens](entretiens.md#étape-de-la-piste)),
  bascule des pistes d'une étape supprimée vers l'étape de remplacement.

Choisir l'étape où la piste est déjà ne trace rien.

Les noms d'étape sont enregistrés tels qu'ils étaient au moment du changement : renommer ou
supprimer une étape plus tard ne modifie pas l'historique. Ces entrées ne se modifient pas.

L'historique des étapes existe depuis le 19/11/2026 : les changements antérieurs n'ont pas été
enregistrés.
