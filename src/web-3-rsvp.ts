import {
  ConfirmedAttendee,
  DepositsPaidOut,
  NewEventCreated,
  NewRSVP,
} from '../generated/Web3RSVP/Web3RSVP';
import { Account, RSVP, Confirmation, Event } from '../generated/schema';
import { integer } from '@protofire/subgraph-toolkit';
import { Address, ipfs, json } from '@graphprotocol/graph-ts';

export function handleConfirmedAttendee(event: ConfirmedAttendee): void {
  const id =
    event.params.eventID.toHex() + event.params.attendeeAddress.toHex();
  const account = getOrCreateAccount(event.params.attendeeAddress);
  const thisEvent = Event.load(event.params.eventID.toHex());
  let newConfirmation = Confirmation.load(id);

  if (!newConfirmation && thisEvent) {
    newConfirmation = new Confirmation(id);
    newConfirmation.attendee = account.id;
    newConfirmation.event = thisEvent.id;
    newConfirmation.save();

    thisEvent.totalConfirmedAttendees = integer.increment(
      thisEvent.totalConfirmedAttendees
    );
    thisEvent.save();

    account.totalAttendedEvents = integer.increment(
      account.totalAttendedEvents
    );
    account.save();
  }
}

export function handleDepositsPaidOut(event: DepositsPaidOut): void {
  const thisEvent = Event.load(event.params.eventID.toHex());

  if (thisEvent) {
    thisEvent.paidOut = true;
    thisEvent.save();
  }
}

export function handleNewEventCreated(event: NewEventCreated): void {
  const params = event.params;
  let newEvent = Event.load(params.eventID.toHex());

  // Check if event with given ID doesn't already exist and only then create a new event
  if (!newEvent) {
    newEvent = new Event(params.eventID.toHex());
    newEvent.eventID = params.eventID;
    newEvent.eventOwner = params.creatorAddress;
    newEvent.eventTimestamp = params.eventTimestamp;
    newEvent.maxCapacity = params.maxCapacity;
    newEvent.deposit = params.deposit;
    newEvent.paidOut = false;
    newEvent.totalRSVPs = integer.ZERO;
    newEvent.totalConfirmedAttendees = integer.ZERO;

    const metadata = ipfs.cat(params.eventDataCID + '/data.json');

    if (metadata) {
      const value = json.fromBytes(metadata).toObject();
      if (value) {
        const name = value.get('name');
        const description = value.get('description');
        const link = value.get('link');
        const imagePath = value.get('image');

        if (name) newEvent.name = name.toString();
        if (description) newEvent.description = description.toString();
        if (link) newEvent.link = link.toString();

        // If image path doesn't exist set fallback image
        newEvent.imageURL = imagePath
          ? 'https://ipfs.io/ipfs/' + params.eventDataCID + imagePath.toString()
          : 'https://ipfs.io/ipfs/bafybeibssbrlptcefbqfh4vpw2wlmqfj2kgxt3nil4yujxbmdznau3t5wi/event.png';
      }
    }

    newEvent.save();
  }
}

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address.toHex());
  if (!account) {
    account = new Account(address.toHex());
    account.totalRSVPs = integer.ZERO;
    account.totalAttendedEvents = integer.ZERO;
    account.save();
  }
  return account;
}

export function handleNewRSVP(event: NewRSVP): void {
  const id =
    event.params.eventID.toHex() + event.params.attendeeAddress.toHex();
  const account = getOrCreateAccount(event.params.attendeeAddress);
  const thisEvent = Event.load(event.params.eventID.toHex());
  let newRSVP = RSVP.load(id);

  if (!newRSVP && thisEvent) {
    newRSVP = new RSVP(id);
    newRSVP.attendee = account.id;
    newRSVP.event = thisEvent.id;
    newRSVP.save();
    thisEvent.totalRSVPs = integer.increment(thisEvent.totalRSVPs);
    thisEvent.save();
    account.totalRSVPs = integer.increment(account.totalRSVPs);
    account.save();
  }
}
