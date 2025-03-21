// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";
export type RangeAvailability = {
  id: number,
  creatorUserId: number,
  availabilityLevel: number,
  rangeStart: string,
  rangeEnd: string,
};

/**
 * A namespace for generated helper functions.
 */
export namespace RangeAvailability {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
      new ProductTypeElement("id", AlgebraicType.createU32Type()),
      new ProductTypeElement("creatorUserId", AlgebraicType.createU32Type()),
      new ProductTypeElement("availabilityLevel", AlgebraicType.createI8Type()),
      new ProductTypeElement("rangeStart", AlgebraicType.createStringType()),
      new ProductTypeElement("rangeEnd", AlgebraicType.createStringType()),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: RangeAvailability): void {
    RangeAvailability.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): RangeAvailability {
    return RangeAvailability.getTypeScriptAlgebraicType().deserialize(reader);
  }

}


