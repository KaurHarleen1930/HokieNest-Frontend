export enum HousingStatus {
  SEARCHING = 'SEARCHING',
  HAVE_HOUSING = 'HAVE_HOUSING',
  SEEKING_ROOMMATE = 'SEEKING_ROOMMATE',
  NOT_SEARCHING = 'NOT_SEARCHING'
}

export const HousingStatusLabels: Record<HousingStatus, string> = {
  [HousingStatus.SEARCHING]: 'Searching for housing',
  [HousingStatus.HAVE_HOUSING]: 'Have housing',
  [HousingStatus.SEEKING_ROOMMATE]: 'Have housing, seeking roommate',
  [HousingStatus.NOT_SEARCHING]: 'Not currently searching'
};