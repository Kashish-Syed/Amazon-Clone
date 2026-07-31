import React from 'react';
import '../css/DeliveryOptions.css';
import { useStateValue } from './StateProvider';
import { ACTIONS } from './reducer';
import { listRegions } from '../../domain/tax';
import { listShippingMethods } from '../../domain/shipping';
import { config } from '../../config';
import { format } from '../../lib/money';

// Where the order is going and how fast.
//
// Both feed the pricing engine: the region sets the tax rate and decides
// whether shipping is taxable, the method sets the delivery charge. They are
// here rather than hardcoded because a total that cannot change with
// destination is not a total, it is a guess.
//
// A real checkout collects a full address and derives the tax region from it.
// This is a region picker standing in for that, so the tax logic has a real
// input without building an address form.
function DeliveryOptions() {
  const [{ checkout }, dispatch] = useStateValue();

  const regions = listRegions();
  const methods = listShippingMethods(config.features);

  return (
    <div className="deliveryOptions">
      <div className="deliveryOptions_field">
        <label htmlFor="delivery-region">Delivery region</label>
        <select
          id="delivery-region"
          value={checkout.regionCode}
          onChange={(event) =>
            dispatch({ type: ACTIONS.SET_REGION, regionCode: event.target.value })
          }
        >
          {regions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="deliveryOptions_field">
        <legend>Delivery speed</legend>

        {methods.map((method) => (
          <label key={method.id} className="deliveryOptions_method">
            <input
              type="radio"
              name="shipping-method"
              value={method.id}
              checked={checkout.shippingMethodId === method.id}
              onChange={() =>
                dispatch({ type: ACTIONS.SET_SHIPPING_METHOD, methodId: method.id })
              }
            />
            <span>
              <strong>{method.label}</strong> &mdash; {method.estimate} (
              {format(method.baseCents / 100)})
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export default DeliveryOptions;
