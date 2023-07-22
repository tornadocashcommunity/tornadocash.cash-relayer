import { BigNumber, BigNumberish } from 'ethers';

export const parseJSON = (str: string) => {
  let parsed = null;
  try {
    parsed = JSON.parse(str);
    if (typeof parsed === 'string') parsed = parseJSON(parsed);
    return parsed;
  } catch (e) {
    return parsed;
  }
};

export const bump = (value: BigNumberish, percent: number | BigNumber): BigNumber => {
  const hundredPercents = BigNumber.from(100);

  return BigNumber.from(value).mul(hundredPercents.add(percent)).div(hundredPercents);
};
